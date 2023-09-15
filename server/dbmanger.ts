import * as AWS from "aws-sdk";
AWS.config.update({
    region: process.env.REGION,
  });
import { DynamoDB } from "aws-sdk";
import { FailedUploadToDBError, NotFoundError } from "./errors";
import { param } from "jquery";

const DATA_TABLE: string = process.env.DATA_TABLE;
const dynamoDbClient: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient();

interface AttributeValueInput {
    key: string,
    value: string | number,
}
  
const getExpressionAttributeValues = (params: AttributeValueInput[]) => {
    let result: { [key: string]: string | number } = {};

    params.forEach(param => {
        result[`:${param.key}`] = param.value;
    });

    return result;
};

// set get parames: Get by ID
const getIdParams = (eventId: string): DynamoDB.DocumentClient.QueryInput => ({
    TableName: DATA_TABLE,
    KeyConditionExpression: "#eventId = :eventId",
    ExpressionAttributeNames: {
      "#eventId": "eventId"
    },
    ExpressionAttributeValues: getExpressionAttributeValues([{ key: 'eventId', value: eventId }])
  });

// set get params: Get by Email
const getEmailParams = (email: string, stubName: string): DynamoDB.DocumentClient.QueryInput => ({
    TableName: DATA_TABLE,
    IndexName: "EmailIndex",
    KeyConditionExpression: "email = :email and stubName = :stubName",
    ExpressionAttributeValues: getExpressionAttributeValues([{ key: 'email', value: email }, { key: 'stubName', value: stubName }]),
});

//set put params
const getPutParams = (item: Object): DynamoDB.DocumentClient.PutItemInput=> ({
    TableName: DATA_TABLE,
    Item: item
});


async function getDataFromDynamoDB(getParams: DynamoDB.DocumentClient.QueryInput) {
    try {
        const data = dynamoDbClient.query(getParams).promise();
        return data
    } catch (err) {
        console.error(err)
    }
        
}

async function putDataIntoDynamoDB(putParams: DynamoDB.DocumentClient.PutItemInput) {
    try {
        const data = dynamoDbClient.put(putParams).promise();
        return data;
    } catch (err) {
        console.error(err);
    }
    
}

export async function getByEmail(email: string, stubName: string) {
    try {
        const param = getEmailParams(email, stubName);
        console.error(param)
        const data = await getDataFromDynamoDB(param);
        return data;
    } catch (err) {
        throw new NotFoundError(`{Cannot get item with email:${email} stubName:${stubName}}`)
    }
}

export async function getByID(eventId: string) {
    try {
      const getParams = getIdParams(eventId);
      const data = await getDataFromDynamoDB(getParams);
  
      if (!data) {
        throw new Error(`Cannot get item with id: ${eventId}`);
      }
      
      return data;
    } catch (err) {
      console.error(err);
      throw new Error(`Cannot get item with id: ${eventId}`);
    }
  }

export async function putData(item: Object) {
    try {
        const param = getPutParams(item);
        const data = await putDataIntoDynamoDB(param);
        return data;
    } catch (err) {
        throw new FailedUploadToDBError(`cannot putData to db: ${param}`);
    }
}

async function isTableEmpty(tableName: string): Promise<boolean> {
    const params = {
        TableName: tableName,
        Select: "COUNT"
    };

    try {
        const result = await dynamoDbClient.scan(params).promise();
        return result.Count === 0;
    } catch (err) {
        console.error(`Error checking if table is empty: ${err}`);
        throw err; // Or handle error as needed
    }
}


export async function checkIFEventEmpty() {
    return isTableEmpty(DATA_TABLE)
}
  

