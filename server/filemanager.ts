import { FailedUploadToS3Error, InputError, NotFoundError } from "./errors";
import { Logger } from "./logger";
import { S3 } from 'aws-sdk';

const STORAGE_BUCKET: string = process.env.STORAGE_BUCKET;
let exp_time: string = process.env.EXP_TIME;
const signedUrlExpireSeconds: number = Number(exp_time);
type FileNameMap = Map<string, number>;
const logger = new Logger(process.env.LOG_LEVEL || 'INFO');


function incrementFileName(
  fileNameMap: FileNameMap,
  fileName: string
) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const base = (lastDotIndex === -1) ? fileName : fileName.substring(0, lastDotIndex);
  const ext = (lastDotIndex === -1) ? "" : fileName.substring(lastDotIndex);
  
  const num = (fileNameMap.get(fileName) || 0) + 1;
  fileNameMap.set(fileName, num);

  const timestamp = Date.now();
  return `${base}_${timestamp}_${num}${ext}`;
}


async function  validateInputFileData(fileData: string, pathArray:string[]) {
  if (!fileData) {
    throw new InputError(`need file in path: ${pathArray}`)
  }
  let fileInfoArr: string[] = fileData.split(";")
  const metadata: string  = fileInfoArr.find((info: string) => info.startsWith("name"));
  const content: string = fileInfoArr.find((info: string) => info.startsWith("base64"));

  const fileName = metadata.split("=")[1];
  const fileBody = content.split(",")[1];

  if (!fileName || !fileBody) {
    throw new NotFoundError(`Cannot find name of the file:${fileName} or body of the file:${fileBody}`)
  }
  return {fileName, fileBody};
}


export function getFileDataFromInstance(instance: any, pathArray: string[]) {
    let fileData = instance;
    for (const path of pathArray) {
      fileData = fileData[path];
    }
    return fileData;
}


export async function handleFileUpload(
  fileData: string,
  uid: string,
  pathArray: string[],
  instance: any,
  fileNameMap: FileNameMap,
  s3: S3
) {
  try {
    // ignore path with no data! arbitrary file upload
    if (!fileData) {
      return;
    }
    let {fileName, fileBody} = await validateInputFileData(fileData, pathArray)
    const updatedFileName = fileNameMap.has(fileName) ? incrementFileName(fileNameMap, fileName) : fileName;
    fileNameMap.set(fileName, 1);

    let s3Key = `${uid}/${updatedFileName}`;
    const fileBuffer: Buffer = Buffer.from(fileBody, "base64");
    let updateInstance = instance;

    for (let i = 0; i < pathArray.length - 1; i++) {
      updateInstance = updateInstance[pathArray[i]];
    }

    try {
      await s3.upload({
        Bucket: STORAGE_BUCKET,
        Key: s3Key,
        ContentEncoding: "base64",
        Body: fileBuffer,
      }).promise();

      // Replace dynamoDB upload with filename
      updateInstance[pathArray[pathArray.length - 1]] = updatedFileName;
      logger.error("Successfully Uploaded to S3");
      return
    } catch(err) {
      console.error(err)
      throw new FailedUploadToS3Error(`Failed to upload file to S3.}`)
    }
  } catch (err) {
    console.error(err);
    throw new FailedUploadToS3Error(`S3 file upload failed. Original error: ${err.message}`)
  }
}
 

export async function handleFileRetrieval(instance: any, pathArray: string[], fileName: string, s3: S3) {
    try {
        let s3Key = `${instance.eventId}/${fileName}`;
  
        let updateInstance = instance.data;
        for (let i = 0; i < pathArray.length - 1; i++) {
          updateInstance = updateInstance[pathArray[i]];
        }
      
        let signedURL = s3.getSignedUrl("getObject", {
          Bucket: STORAGE_BUCKET,
          Key: s3Key,
          Expires: signedUrlExpireSeconds,
        });
        logger.error("SignedURL: " + signedURL);
      
        updateInstance[pathArray[pathArray.length - 1]] = signedURL;
        return;
    } catch (err) {
      console.error(err)
      throw new NotFoundError(`File retrieve failed in S3. eid: ${instance.eventId}, fileName:${fileName}. Original error: ${err.message}`)
    }
  }