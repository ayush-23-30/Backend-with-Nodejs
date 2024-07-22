import { asyncHandler } from "../utils/asycnHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

/*
tasks to do for the register user
1. Get user details like email , password , username 
2. validation (email, name empty toh nahi hai valid hai na) 
3. check if user already exists or not 
4. check for images and avatar 
5. upload them to cloudinary 
6. remove password and refresh tokens field from response 
7. create user object for mongoDB 
8.check for the user creation 
9. return response  

*/

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // refresh token ko database m dalna
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while creating access and refresh token "
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  console.log("email : ", email);

  //  if(fullname ===  "" ) {
  //   throw new ApiError(400, "All fields are required ")
  // } this is a way you check ever feild

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required ");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "user with email or username is already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path; // from multer

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, " avatar files is required");
  }

  const avatar = await uploadCloudinary(avatarLocalPath);
  const coverImage = await uploadCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "all feilds are required ");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  const CreatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!CreatedUser) {
    throw new ApiError(500, "something went wrong  while registering User ");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, CreatedUser, "User registor sucessfully "));

  // res.status(200).json({
  //   messgae : "ayush aur backend"
  // })
});

const loginUser = asyncHandler(async (req, res) => {
  // steps 1. req.body -> Data
  // 2. userName or email
  // 3. find the user
  // 4. password check  correct or not
  // 5. tokens -- refresh and access
  // 6.send tokens in cookies

  const { email, username, password } = req.body;
  // step 1 . username or email
  // if (!username && !email) { // jab dono m se 1 chliye aise karke
  if (!(username || email)) {
    throw new ApiError(400, "give me either  username  or email ");
  }
  // step 2 finding the user exist or not
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(400, "user don't exists");
  }
  // step 3. password is correct or not

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  ); // ye ye nahi chlie iske ander

  // sending cookies
  const options = {
    httpOnly: true, // cookies k options ye hai by defualt usko koi bhi update kar sakta hai per iske bad nahi karr paayega

    secure: true, // ab bss server se hi modify hogi
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in SuccessFully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // steps : 1. remove cookieParser
  // 2. expriy of refresh token and accessToken
  // how to find the user kyuki uper toh humne email se kar liya hai yaha kase karege
  // by using middleware cookie both way access hoti hai

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true, // cookies k options ye hai by defualt usko koi bhi update kar sakta hai per iske bad nahi karr paayega

    secure: true, // ab bss server se hi modify hogi
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out "));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  // ye incoming vala hai hum lere hai kyukki hamare pass bhi toh 1 rhka hi hai

  if (!incomingRefreshToken) {
    throw new ApiError(401, "invaild incoming token ");
  }
  // verify incomingToken
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?.$or_id);

    if (!user) {
      throw new ApiError(401, "donot find the user refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used ");
    }

    const options = {
      httpOnly: true,
      secured: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "access token refreshed "
      );
  } catch (error) {
    throw new ApiError(
      401,
      error?.message || "invaild refresh token in the incoming refresh token "
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isOldPasswordCorrect) {
    throw new ApiError(401, "your entered old password is invalid ");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed  successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!(fullname || email)) {
    throw new ApiError(
      404,
      "all feilds are required to update account details "
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details update succesfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  //TODO: delete old image - assignment

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage update Error");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "cover image file is missing");
  }

  const user = await user
    .findByIdAndUpdate(
      req.file?._id,
      {
        $set: {
          // user to set new image in mongo db
          coverImage: coverImage.url,
        },
      },
      {
        new: true,
      }
    )
    .select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username not find in channel profile");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subcribersCount: {
          $size: "$subscribers",
        },
      },
    },
    {
      channelSubscribeToCount: {
        $size: "$subscribedTo",
      },
    },
    {
      isSubscribed : {
        $cond : {
          if : {$in : [req.user?._id , " $subscribers.subscriber"]}, then : true, else : false 
        }
        
      }
    } ,  
    {
      $project : {
        fullname : 1, 
        username : 1 , 
        subcribersCount : 1, 
        channelSubscribeToCount : 1, 
        isSubscribed : 1, 
        avatar : 1, 
        coverImage : 1, 
        email : 1,
        }
    } 

  ])

  // console.log("channel : " , channel);
  
  if(!channel?.length){
    throw new ApiError(404, "channel does not exists")
  }

  return res
  .status(200)
  .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile
};
