import express from "express";
import { Request as ExpressRequest, Response, NextFunction, RequestHandler } from "express";
import serverless from "serverless-http";
import cors from "cors";
import { LoginTicket, OAuth2Client } from "google-auth-library";
import { NotFoundError, InputError, UnauthorizedError, FailedUploadToS3Error, FailedUploadToDBError, UserExistsError, UserNotExistsError, DeleteError } from './errors';
import { getFileDataFromInstance, handleFileRetrieval, handleFileUpload } from "./filemanager";
import {getUserFromUserPermissionsTable, handleAdminRequest, createAdminUser} from './authmanager'
import { getByEmail, getByID, putData, checkIFEventEmpty} from "./dbmanger";
import { Logger } from "./logger";
import * as AWS from "aws-sdk";
const s3: any = new AWS.S3();
AWS.config.update({
  region: process.env.REGION,
});
import { DynamoDB } from 'aws-sdk';

const dynamoDB = new DynamoDB.DocumentClient();
const google_client: OAuth2Client = new OAuth2Client(process.env.CLIENT_ID);
type JSON = { [key: string]: any };
const pathJsonObject: { [key: string]: JSON } = {};
const app = express();
const stage = process.env.MODE
const logger = new Logger(process.env.LOG_LEVEL || 'INFO');
// Enable file uploads of up to 20 MB. hard code fix together with serverless!
app.use(express.json({ limit: process.env.FILE_SIZE }));
app.use(cors());

interface UserPermissions {
  email: string;
  role: string;
  permissions: Record<string, Record<string, boolean>>;
}

interface Request extends ExpressRequest {
  permissions?: UserPermissions;
}



//------------------------------------------Authentication and Authorization from here------------------------------------

/**
 * Middleware function: googleAuthMiddleware
 * @param req jwt token stored inside request
 * @param res 401 Unauthorized by Google
 * @param next if success, return promise to next function
 * @returns
 */
const googleAuthMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const jwtToken = req.body.jwtToken || req.query.jwtToken;
  // if we are at test stage, we temporary skip the authorizations
  if (stage === 'test') {
    next();
    return;
  } else {
    console.log(process.env.MODE)
    console.log(stage)
  }
  console.log("current stage: " +stage)
  if (!jwtToken) {
    next(new UnauthorizedError("Unauthorized, no token provided"));
    return
  }
  try {
    const ticket: void | LoginTicket = await google_client.verifyIdToken({
        idToken: jwtToken,
        audience: process.env.CLIENT_ID,
    })

    if (ticket) {
      const payload = ticket.getPayload();
      const expiryDate = payload && payload.exp ? payload.exp * 1000 : null; // convert to milliseconds

      // Check if the token has expired
      if (expiryDate && new Date() > new Date(expiryDate)) {
        next(new UnauthorizedError("Unauthorized, token expired"));
      }
      next(); 
      return
    }else {
      next(new UnauthorizedError("Unauthorized, no ticket received"));
    }
  } catch(err) {
    next(new UnauthorizedError("Unauthorized, failed to verify token"));
  }
};

/**
 * Middleware function: ensureAdmin
 * @param req jwt token stored inside request
 * @param res 401  if log in user is not admin
 * @param next if success, return promise to next function
 * @returns
 */
const ensureAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(req.query)
  // console.log(req)
  let usr_email = req.query.authEmail || req.body.authEmail;
  console.log(`get user email ${usr_email}`)
  const userPermissions = await getUserFromUserPermissionsTable(usr_email);
  console.log(userPermissions)
  if (userPermissions.role !== 'admin') {
    next(new UnauthorizedError("Unauthorized, only admins can access this resource"));
    return;
  }
  next();
};


app.use((req, res, next) => {
  console.error(`request -- ${req.method} ${req.path}`);
  next();
}); 

/** heartbeat
 *  keep server warm
 */
app.post("/heartbeat", async function (req: Request, res: Response) {
  res.status(200).json({
    status: "heartbeat",
  });
});

//-----------------------------------------------------Data Table from here------------------------------------
/** Login 
 * Method: POST
 * URL:/gooleLogin
 * Desc: handling user log in using google
 * Params: {
     data: {
        token: token
     }
    }
    response: {
      body: {
        http code: 200 'success',
        userId: userid,
        email: email
      }
    }
 */
  app.post("/googleLogin", googleAuthMiddleware, async function (req: Request, res: Response, next: NextFunction) {
    try {
      const userPermissions = await getUserFromUserPermissionsTable(req.body.authEmail);
      res.json(userPermissions); 
    } catch (e) {
      next(e)
    }
  });


  app.post("/createAdmin",async function (req: Request, res: Response, next: NextFunction) {
    try {
      if (checkIFEventEmpty()) {
        createAdminUser(req.body.email)
        res.json({ status: "success" }); 
      }
    } catch (e) {
      next(e)
    }
  })


/**uploadData
 * Method: POST
 * URL:/uploadData
 * Desc: current user upload jsonschema data under the given stub
 * Params: {
     data: {
        eventId: String,
        email: String,
        stubName: String,
        Data: Object,
        jwtToken: String
     }
    }
 */
app.post("/uploadData", googleAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let email:string = req.body.email

    const userPermissions = await getUserFromUserPermissionsTable(email);

    // Check if the user has permission to write this stub
    if (!userPermissions.permissions[req.body.stubName]?.W && userPermissions.role !== 'admin') {
      next(new UnauthorizedError("Unauthorized, user does not have permission to write this stub"));
      return;
    }

    const eid_ = Math.random().toString(26).slice(-2).toUpperCase() + String(Date.now()).slice(-3);
    let instance: any = req.body.data;
    // If the stub has files, process them.
    if (pathJsonObject.hasOwnProperty(req.body.stubName)) {
      logger.error("files exist");
      const pathFile = pathJsonObject[req.body.stubName];
      const fileNameMap = new Map();

      for (const key in pathFile) {
        if (!pathFile.hasOwnProperty(key)) continue;

        const pathArray = pathFile[key];
        let fileData = getFileDataFromInstance(instance, pathArray);
        
        if (String(fileData) !== "") {
          await handleFileUpload(fileData, eid_, pathArray, instance, fileNameMap, s3);
        }
      }
    }

    req.body.data = instance;
    const item = {
      ...req.body,
      eventId: eid_,
    };
    delete item.jwtToken;
    // Upload data to dynamoDB
    await putData(item);
    res.status(200).json({eventId: eid_,}).end();
    // next();
  } catch (err) {
    console.error(err)
    next(err)
  }
});

/**GetByEmail
 * Method: GET
 * URL:/getByEmail?email=test@usc.edu&stubName=Table1&jwtToken=token
 * Desc: get user information by email ans stubName, 
 * Auth: admin could visit all the data, user could visit data only with permissions
 */
app.get("/getByEmail", googleAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    logger.error("getByEmail called");
    logger.error("looking for data in table: " + req.query.stubName);
    if (typeof req.query.email !== 'string' || typeof req.query.stubName !== 'string') {
      next(new InputError("Invalid email or stubName"));
      return;
    }
    let email:string = req.query.email
    let stub = req.query.stubName 

    const userPermissions = await getUserFromUserPermissionsTable(email);

    // Check if the user has permission to read this stub. NOTE: This will crash if the user does not exist in the table.
    if (!userPermissions.permissions[stub]?.R && userPermissions.role !== 'admin') {
      next(new UnauthorizedError("Unauthorized, user does not have permission to read this stub"));
      return;
    }

    try {
      const data = await getByEmail(email, stub);
      if (data.Count == 0) {
        next(new NotFoundError("No data returned"));
        return;
      }
      // If the stub has files, process them.
      if (pathJsonObject.hasOwnProperty(stub)) {
        logger.error("Files exist");
        const pathFile = pathJsonObject[stub];
        logger.error(JSON.stringify(data));

        // For each row returned, gather its files from S3.
        for (const instance of data.Items) {
          logger.error(JSON.stringify(instance));
          for (const key in pathFile) {
            const pathArray = pathFile[key];
            let fileName = getFileDataFromInstance(instance.data, pathArray);
            if (String(fileName) !== "") {
              await handleFileRetrieval(instance, pathArray, fileName, s3);
            }
          }
        }
      }

      res.status(200).json(data.Items);
      next();
    } catch (err) {
      console.error(err)
      next(err)
    }
  }
);
 

app.get("/getById",  googleAuthMiddleware, async function (req: Request, res: Response, next: NextFunction) {
  logger.error("getByID called");
  logger.error("looking for data with id: " + req.query.eventId);
  if (typeof req.query.eventId !== 'string') {
    next(new InputError("Invalid eventId"));
    return;
  }
  try {
    const data = await getByID(req.query.eventId);
    if (data.Count == 0) {
      next(new NotFoundError("No data returned"))
    }
    res.json(data.Items);
    next();
  } catch(err) {
    console.error(err)
    next(err)
  }
})


//-----------------------------------------------------user/admin management from here-----------------------

/** deleteUserPermission
 * Method: DELETE
 * URL:/deleteUserPermission?authEmail=&email=&jwtToken=
 * Desc: delete user inside user/admin management system
 * HTTP code: 200
 */
app.delete("/deleteUserPermission", googleAuthMiddleware, ensureAdmin, async function (req: Request, res: Response, next: NextFunction) {
  try {
    const target_email = req.query.email;
    if(typeof target_email === 'string') {
      await handleAdminRequest('delete', target_email);
      res.status(200).json(`user ${target_email} has been deleted`);
    } else {
      res.status(400).json('Invalid request. Please provide email.');
    }
  } catch (e) {
    next(e)
  }
});


/**UpdateUserPermission
 * Method: POST
 * URL:/UpdateUserPermission
 * Desc: update user permission data (role, permissions) inside user/admin management system
 * Params: {
     data: {
        authEmail; your login email for authorization String,
        role: "admin"/"user",
        email: String,
        jwtToken: String,
        permissions: {
          stubName1: {
            "R": boolean,
            "W": boolean,
            "U": boolean,
            "D": boolean
          },
          stubName2: {
            "R": boolean,
            "W": boolean,
            "U": boolean,
            "D": boolean
          },...
        }
    }
    HTTP code: 200
 */
app.post("/UpdateUserPermission", googleAuthMiddleware, ensureAdmin, async function (req: Request, res: Response, next: NextFunction) {
  try {
    const target_role = req.body.role;
    const target_email = req.body.email;
    const target_permissions = req.body.permissions;
    await handleAdminRequest("update", target_email, target_role, target_permissions);
    let updateUser = await handleAdminRequest('read', target_email)
    
    res.status(200).json(updateUser);
    
  } catch (e) {
    next(e)
  }
});


/**CreateUserPermission
 * Method: POST
 * URL:/CreateUserPermission
 * Desc: create a new user into user/admin system
 * Params: {
     data: {
        authEmail; your login email for authorization String,
        role: "admin"/"user",
        email: String,
        jwtToken: String,
        permissions: {
          stubName1: {
            "R": boolean,
            "W": boolean,
            "U": boolean,
            "D": boolean
          },
          stubName2: {
            "R": boolean,
            "W": boolean,
            "U": boolean,
            "D": boolean
          },...
        }
    }
    HTTP code: 201
 */
app.post("/CreateUserPermission", googleAuthMiddleware, ensureAdmin, async function (req: Request, res: Response, next: NextFunction) {
  try {
    const target_role = req.body.role;
    const target_email = req.body.email;
    const target_permissions = req.body.permissions;

    await handleAdminRequest('create', target_email, target_role, target_permissions);
    let newUser = await handleAdminRequest('read', target_email)
    
    res.status(201).json(JSON.stringify(newUser));
  } catch (e) {
    next(e)
  }
});


/** getAllPermissions
 * Method: GET
 * URL:/getAllPermissions?jwtToken=?authEmail=
 * Desc: get all users and admin permission inside user/admin system
 * HTTP code: 200
 */
app.get('/getAllPermissions', googleAuthMiddleware, ensureAdmin, async function (req: Request, res: Response, next: NextFunction) {
  try {
    const data = await handleAdminRequest("scan");
    res.status(200).json(data);
  } catch(err) {
    next(err)
  }
})


// error handler middleware
app.use(async (err: Error, req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (err instanceof NotFoundError) {
      console.error(`NotFoundError: ${err.message}`);
      res.status(404).json(err.message);
    } else if (err instanceof InputError) {
      console.error(`InputError: ${err.message}`);
      res.status(422).json(err.message );
    } else if (err instanceof UnauthorizedError) {
      console.error(`Unauthorized Error: ${err.message}`);
      res.status(401).json(err.message );
    } else if (err instanceof FailedUploadToS3Error) {
      console.error(`Failed Upload To S3 Error: ${err.message}`);
      res.status(422).json(err.message );
    } else if (err instanceof FailedUploadToDBError) {
      console.error(`Failed Upload To DynameDB Error: ${err.message}`);
      res.status(422).json(err.message );
    } else if (err instanceof UserExistsError) {
      console.error(`User Exists Error: ${err.message}`);
      res.status(409).json(err.message);
    } else if (err instanceof UserNotExistsError) {
      console.error(`User Not Exists Error: ${err.message}`);
      res.status(400).json(err.message );
    } else if (err instanceof DeleteError) {
      console.error(`User Delete Error: ${err.message}`);
      res.status(403).json(err.message );
    }else {
      console.error(`Unknown Error: ${err.message}`);
      res.status(500).json(err.message );
    }
  } catch (err) {
    console.error(`Error Handling Error: ${err.message}`);
    next(err);
  }
});


// localhost running
app.listen(8800, () => {
  console.log("Backend server is running!");
});

export const handler = serverless(app);

