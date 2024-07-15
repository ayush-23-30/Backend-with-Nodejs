import { v2 as cloudinary } from "cloudinary";
import fs from 'fs'

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadCloudinary = async (localFilePath) =>{
  try{
    if(!localFilePath) return null
    //upload the file on cloudinary 
    const response =  await cloudinary.uploader.upload(localFilePath,{
      resource_type : "auto"
    })
    // file has been uploaded successfully 
    // console.log("file is uploaded on cloudinary" , response.url);
    fs.unlinkSync(localFilePath)// unlink kar diya takki load na pade cloudinary p kyuki hum kuch karna nahi h uska
    
    return response;


  }catch(err){
    fs.unlinkSync(localFilePath) // remove the locally temporary file as the upload operation got failed  
    return null;
  }
}

export  {uploadCloudinary}; 


// agar isko local file ka path mile jae toh ye apna kam kar dega iska kam upload karna hai file ko jo aaegi local path se jiske liye hum {multer} use karre hai 