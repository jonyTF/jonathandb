import { DynamoDB } from 'aws-sdk';
import { DeleteError, NotFoundError, UserExistsError, UserNotExistsError } from './errors';
import * as AWS from "aws-sdk";

AWS.config.update({
    region: process.env.REGION,
  });

const dynamoDB = new DynamoDB.DocumentClient();


interface UserPermissions {
  email: string;
  role: string;
  permissions: Record<string, Record<string, boolean>>;
}
const PERMISSIONTABLE = process.env.PERMISSIONS_TABLE;
// Create user
async function createUser(email: string, role: string, permissions: Record<string, Record<string, boolean>>) {
    try {
      let checkUser = await getUser(email);
  
      if (checkUser !== undefined) {
        throw new UserExistsError("Could not create new user, user already exists.")
      } else {
        const params = {
          TableName: PERMISSIONTABLE,
          Item: {
            email,
            role,
            permissions
          }
        };
        
        await dynamoDB.put(params).promise();
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
 

// Read user
async function getUser(email: string): Promise<UserPermissions> {
    const params = {
      TableName: PERMISSIONTABLE,
      Key: {
        email
      }
    };
    try {
        const result = await dynamoDB.get(params).promise();
        return result.Item as UserPermissions;
    } catch (err) {
        console.error(err)
    }
  }
  

// Update user
async function updateUser(email: string, role: string, permissions: Record<string, Record<string, boolean>>) {
    try {
        let checkUser = await getUser(email);
    
        if (checkUser === undefined) {
          throw new UserNotExistsError("Could not update user, create a new one with this email")
        } else {
            const params = {
                TableName: PERMISSIONTABLE,
                Key: {
                email
                },
                ExpressionAttributeNames: {
                '#role': 'role',
                '#permissions': 'permissions'
                },
                ExpressionAttributeValues: {
                ':role': role,
                ':permissions': permissions
                },
                UpdateExpression: 'SET #role = :role, #permissions = :permissions'
            };
            await dynamoDB.update(params).promise();
        } 
    } catch (err) {
        console.error(err);
        throw err;
    }
}

// Delete user
async function deleteUser(email: string) {
  try {
    let currentUser = await getUser(email);
    if (currentUser === undefined) {
      throw new UserNotExistsError('User not found');
    }
    let userRole = currentUser.role;
    if (userRole === 'user') {
      const params = {
          TableName: PERMISSIONTABLE,
          Key: {
          email
          }
      };
      await dynamoDB.delete(params).promise();
    } else if (userRole === 'admin') {
      const adminCount = await getAdminCount();
      if (adminCount > 1) {
        const params = {
          TableName: PERMISSIONTABLE,
          Key: {
          email
          }
        };
        await dynamoDB.delete(params).promise();
      } else {
        console.error("err")
        throw new DeleteError("Cannot delete the only admin");
      }
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// Get the number of admins
async function getAdminCount() {
  const params = {
    TableName: PERMISSIONTABLE,
    FilterExpression: "#userRole = :userRole",
    ExpressionAttributeNames:{
      "#userRole": "role"
    },
    ExpressionAttributeValues: {
        ":userRole": "admin"
    }
  };

  const data = await dynamoDB.scan(params).promise();
  return data.Items ? data.Items.length : 0;
}


// scan whole table
async function scanPermissionsTable() {
    const params = {
        TableName: PERMISSIONTABLE,
      };
    
    try {
        const data = await dynamoDB.scan(params).promise();
        if (!data.Items) {
            throw new Error(`No data inside PermissionTable.`);
          }
        return data.Items;

    } catch (err) {
        console.error(err);
    }
}


export async function getUserFromUserPermissionsTable(email: string): Promise<UserPermissions> {
    try {
      const user = await getUser(email!);
      if (!user) {
          throw new NotFoundError(`user with email ${email} not found`)
      }
        return user;
    } catch (err) {
        console.error(err)
    }
    
}


export async function createAdminUser(email: string) {
    const params = {
      TableName: PERMISSIONTABLE,
      Item: {
        email: email,
        role: 'admin',
        permissions: {}
      }
    };
  
    await dynamoDB.put(params).promise();
  }


export async function handleAdminRequest(operation: string, target_email?: string, role?: string, permissions?: Record<string, Record<string, boolean>>) {
  switch (operation) {
    case 'create':
      await createUser(target_email!, role!, permissions!);
      break;
    case 'read':
      const user = await getUser(target_email!);
      console.log(user);
      break;
    case 'update':
      await updateUser(target_email, role, permissions!);
      break;
    case 'delete':
      await deleteUser(target_email);
      break;
    case 'scan':
      let data = await scanPermissionsTable();
      return data;
    default:
      throw new Error('Invalid operation. Available operations are create, read, update, delete, scan.');
  }
}

  
