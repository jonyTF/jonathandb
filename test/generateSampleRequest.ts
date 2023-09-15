import * as fs from "fs";
import * as path from "path";
import { faker } from "@faker-js/faker";

// import { compileFromFile } from "json-schema-to-typescript"; 
// import { Input as schemaType } from "../schemaType";

// Globals to keep track of file path and array indicies for creating file path json.
var globalObjectPath: Object[];
var globalFromArray;
var arrayCounter;
var pathsCount;
var paths: JsonObject;
var pathsWithExtension: JsonObject;

// Generate type of JSON Schema
// const schemaType = compileFromFile(JSchemaFilePath);
// compileFromFile(JSchemaFilePath).then(ts => fs.writeFileSync('schemaType.d.ts', ts));

// Type interface for JsonObject
interface JsonObject {
  [key: string]: any;
}

// Resets the global variables delcared in lines 8-13. Bad practice. Change later.
function resetGlobals() {
  globalObjectPath = [];
  globalFromArray = false;
  arrayCounter = 0;
  pathsCount = 0;
  paths = {} as JsonObject;
  pathsWithExtension = {} as JsonObject;
}


// Parses the UISchema to find the file type of a given property
function parseUISchema(
  uiSchema: JsonObject,
  property: string
): string | undefined {
  for (const key in uiSchema) {
    if (key === property) {
      if (uiSchema[property].hasOwnProperty("ui:options")) {
        const options: JsonObject = uiSchema[property]["ui:options"];
        if (options.hasOwnProperty("accept")) {
          const fileType: string = options["accept"];
          return fileType;
        }
      }
    }
    if (typeof uiSchema[key] === "object") {
      const fileType: string | undefined = parseUISchema(
        uiSchema[key],
        property
      );
      if (fileType !== undefined) {
        return fileType;
      }
    }
  }
  return undefined;
}

// Set a given value of the sample request.
function addPropertyNested(
  path: Object[],
  value: any,
  request: JsonObject
): void {
  var pathSlice: Object[] = path.slice();
  const finalKey = pathSlice.pop();
  const nestedObject = pathSlice.reduce((nestedObj, key) => {
    if (typeof key === "string") {
      if (nestedObj[key] === undefined) {
        nestedObj[key] = {};
      }
      return nestedObj[key];
    }
  }, request);

  if (value instanceof Array && value.length === 1) {
    nestedObject[finalKey as string] = [value[0]];
  } 
  else if (value instanceof Array && globalFromArray) {
    nestedObject[finalKey as string] = [];
    for (var i = 0; i < value.length; i++)
      nestedObject[finalKey as string].push(value[i]);
  }
  else nestedObject[finalKey as string] = value;
}

// Create a dummy string given a JSONSchema object
// TODO: Add more format support
function createString(path: Object[], uiSchema: JsonObject, value: JsonObject): string {
  if (value.hasOwnProperty("format") && value["format"] === "uri-reference") {
    return faker.internet.domainName();
  } else if (value.hasOwnProperty("format") && value["format"] === "data-url") {
    // Add path of this file to paths.json
    const property: string = path.pop() as string;
    var fileType: string | undefined = parseUISchema(uiSchema, property);
    if (fileType === undefined) fileType = ".txt";
    // construct the data URL
    const dataURL = `data:dummy/dummy;name=dummy${fileType};base64,blahblahblah=`;
    path.push(property);
    if (globalFromArray) {
        path.push(arrayCounter);
        addPropertyNested(["path" + pathsCount], globalObjectPath.concat(path), paths);
        addPropertyNested(["path" + pathsCount], globalObjectPath.concat(path).concat(fileType), pathsWithExtension);
        path.pop();
      } else addPropertyNested(["path" + pathsCount], globalObjectPath.concat(path), paths);
      addPropertyNested(["path" + pathsCount], globalObjectPath.concat(path).concat(fileType), pathsWithExtension);
      pathsCount++;

    return dataURL;
  } else {
    return faker.word.noun();
  }
}

// Create a dummy number given a JSONSchema object
// TODO: Add more format support
function createNumber(value: JsonObject): number {
  return faker.datatype.number();
}

// Create a dummy integer given a JSONSchema object
// TODO: Add more format support
function createInteger(value: JsonObject): number {
  if (value.hasOwnProperty("default")) return value["default"];
  if (value.hasOwnProperty("minimum")) return value["minimum"];
  if (value.hasOwnProperty("maximum")) return value["maximum"];

  return faker.datatype.number();
}

// Create a dummy boolean given a JSONSchema object
// TODO: Add more format support
function createBoolean(value: JsonObject): boolean {
  return faker.datatype.boolean();
}

// Create a dummy array given a JSONSchema object
// TODO: Add more format support
function createArray(path: Object[], uiSchema: JsonObject, value: JsonObject): any[] {
  var entryArray: any = [];
  if (value.hasOwnProperty("items")) {
    const items: JsonObject = value["items"];
    if (items.hasOwnProperty("type")) {
      var type = value["items"]["type"];
    }
    var numberOfItems = 1;
    if (value.hasOwnProperty("minItems")) {
      numberOfItems = value["minItems"];
    }
    for (let i = 0; i < numberOfItems; i++) {
      if (type === "string") {
        globalFromArray = true;
        arrayCounter = i;
        entryArray.push(createString(path, uiSchema, items));
        globalFromArray = false;
      }
      if (type === "number") entryArray.push(createNumber(items));
      if (type === "integer") entryArray.push(createInteger(items));
      if (type === "boolean") entryArray.push(createBoolean(items));
      if (type === "object") {
        var propertyPath: Object[] = [];
        globalFromArray = true;
        arrayCounter = i;
        globalObjectPath.push(path[path.length-1]);
        var result = parseJSONSchema(items, uiSchema, propertyPath);
        console.log("result: " + JSON.stringify(result));
        entryArray.push(result);
        globalObjectPath.pop();
        globalFromArray = false;

      }
    }
  }
  // console.log(entryArray);
  return entryArray;
}

// Create a dummy enum selection given a JSONSchema object
function createEnum(path: Object[], value: JsonObject): any {
  return value["enum"][0];
}

// Parse a JSONSchema and create sample values for each entry. Then call a function to add it to the sampleRequest object.
function parseJSONSchema(JSchema: JsonObject, uiSchema: JsonObject, path: Object[]): JsonObject {
  var schema: JsonObject = {} as JsonObject;
  if (JSchema.properties) {
    for (const key in JSchema.properties) {
      const value: JsonObject = JSchema.properties[key];
      if (value.hasOwnProperty("type")) {
        const type = value["type"];

        // If object, recurse it.
        if (type === "object") {
          path.push(key);
          globalObjectPath.push(key);
          var propertyPath: Object[] = [];

          addPropertyNested(path, parseJSONSchema(value, uiSchema, propertyPath), schema);
          path.pop();
          globalObjectPath.pop();
        }
        // If enum, select the first enum
        else if (value.hasOwnProperty("enum")) {
          path.push(key);
          addPropertyNested(path, createEnum(path, value), schema);
          path.pop();
        }
        // If array, generate random array
        else if (type === "array") {
          path.push(key);
          addPropertyNested(path, createArray(path, uiSchema, value), schema);
          path.pop();
        }
        // If string, generate random string
        else if (type === "string") {
          path.push(key);
          addPropertyNested(path, createString(path, uiSchema, value), schema);
          path.pop();
        }
        // If number, generate random number (with restrictions)
        else if (type === "number") {
          path.push(key);
          addPropertyNested(path, createNumber(value), schema);
          path.pop();
        }
        // If integer, generate random integer (with restrictions)
        else if (type === "integer") {
          path.push(key);
          addPropertyNested(path, createInteger(value), schema);
          path.pop();
        }
        // If boolean, generate random boolean
        else if (type === "boolean") {
          path.push(key);
          addPropertyNested(path, createBoolean(value), schema);
          path.pop();
        }
      }
    }
  }
  return schema;
}

// Function to complete the sample request by adding necessary values not present in JSONSchema. 
function addDefaultInfo(request: JsonObject, fileName: string) {
  addPropertyNested(["email"], "test@test.com", request);
  addPropertyNested(["jwtToken", "clientId"], "token", request);
  addPropertyNested(["jwtToken", "credential"], "token", request);
  addPropertyNested(["jwtToken", "select_by"], "user", request);
  addPropertyNested(["stubName"], fileName, request);
}

async function main() {
  // Parse JSONSchema and create sample response
  let propertyPath: Object[] = [];

  // Define paths for the JSON schemas and their corresponding 
  const jsonSchemaFolderPath = path.join(__dirname, "../jsonschema");
  const uiSchemaFolderPath= path.join(__dirname, "../uischema");

  // Strings to store the multiple requests, schemas, and paths
  var jSchemaArray: JsonObject = {};
  var uiSchemaArray: JsonObject = {};
  var requestArray: JsonObject = {};
  var pathArray: JsonObject = {};
  var pathsWithExtensionArray: JsonObject = {};

  // Loop through each JSON Schema and parse them
  const files = await fs.promises.readdir(jsonSchemaFolderPath);  
  files.forEach(file => {
    // Skip ".gitkeep"
    if (file != ".gitkeep") {

      const jSchemaFilePath: string = path.join(jsonSchemaFolderPath, file);
      // Append "ui" to the end of the file name to find the ui schemas
      const extension_index: number = file.lastIndexOf(".");
      var uiFile: string = "";
      if (extension_index !== -1) {
          uiFile = file.substring(0, extension_index) + "ui" + file.substring(extension_index);  // Append "ui" before the extension
      } else {
          uiFile += "ui";  // If there is no extension, simply append "ui" to the file name
      }
      const uiSchemaFilePath: string = path.join(uiSchemaFolderPath, uiFile);

      // Define path of JSONSchema and UISchema
      console.log(jSchemaFilePath);
      const jSchema: JsonObject = JSON.parse(fs.readFileSync(jSchemaFilePath, "utf8"));
      const uiSchema: JsonObject = JSON.parse(fs.readFileSync(uiSchemaFilePath, "utf8"));
      
      // Parses each json and makes them 
      resetGlobals();
      let singleRequest: JsonObject = parseJSONSchema(jSchema, uiSchema, propertyPath);
      file = file.substring(0, extension_index);

      // Build strings containing all schemas and sample requests
      jSchemaArray[file as string] = jSchema;
      uiSchemaArray[file as string] = uiSchema;
      addPropertyNested([file, "data"], singleRequest, requestArray);
      addDefaultInfo(requestArray[file as string], file);
    
      // console.log(requestArray);
      // Only add if paths exist
      if (paths.hasOwnProperty("path0")) {
        pathArray[file as string] = paths;
        pathsWithExtensionArray[file as string] = pathsWithExtension;
      }
    }
  });

  // Write the sampleRequest to a file named 'sampleRequest.json' without JWTToken
  fs.writeFile("test/sampleRequest.json", JSON.stringify(requestArray), (err) => {
    if (err) {
      console.error(err);
    }
  });

  // Write the paths to a file names 'paths.json'
  fs.writeFile("test/paths.json", JSON.stringify(pathArray), (err) => {
    if (err) {
      console.error(err);
    }
  });

  // Write the paths to a file names 'pathsWithFile.json'
  fs.writeFile("test/pathsWithFile.json", JSON.stringify(pathsWithExtensionArray), (err) => {
    if (err) {
      console.error(err);
    }
  });


  fs.readFile('server/handler.js', 'utf8', (err, data) => {
    if (err) throw err;
    
    // Store the values of the JSON Schema as a string in handlertest.
    var modifiedData = data.replace(/var db_schema = {}/, `var db_schema = ${JSON.stringify(jSchemaArray)}`);
    modifiedData = modifiedData.replace(/var pathJsonObject = {}/, `var pathJsonObject = ${JSON.stringify(pathArray)}`);
    fs.writeFile('server/handler.js', modifiedData, (err) => {
      if (err) throw err;
      console.log(`Successfully replaced JSONSchemas and paths in handler.ts`);
    });
  });

  fs.readFile('client/dist/globals.js', 'utf8', (err, data) => {
    if (err) throw err;
    
    var modifiedData = data.replace(/var googleClientId = ""/, `var googleClientId = "${process.env.GOOG_CLIENT_ID}"`);
    modifiedData = modifiedData.replace(/var endpoint = "undefined"/, `var endpoint = "${process.env.ENDPOINT}"`);
    modifiedData = modifiedData.replace(/var jsonSchema = ""/, `var jsonSchema = ${JSON.stringify(jSchemaArray)}`);
    modifiedData = modifiedData.replace(/var uiSchema = ""/, `var uiSchema = ${JSON.stringify(uiSchemaArray)}`);
    modifiedData = modifiedData.replace(/var filepaths = ""/, `var filepaths = ${JSON.stringify(pathsWithExtensionArray)}`);

    fs.writeFile('client/dist/globals.js', modifiedData, (err) => {
      if (err) throw err;
      console.log(`Successfully replaced global variables in globals.js`);
    });
  });

}

main();