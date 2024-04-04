const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const {open} = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db =null;
const initializeDbAndServer = async() => {
    try{
        db = await open({
            filename: dbPath,
            driver:sqlite3.Database,
        });
        app.listen(3000, () => {
            console.log("Server Running at http://locslhost:3000/");
        });

    }catch(error){
        console.log(`DB Error : ${error.message}`);
        process.exit(1);
    }
};
initializeDbAndServer();

//GETTING ARRAY

const getFollowingPeopleIdsOfUser = async (username) => {
    const getFollowingPeopleQuery =`
    select
          following_user_id from follower
          inner join user on user.user_id = follower.follower_user_id
       where user.username ='${username}'';`;
    const followingPeople = await db.all(getTheFollowingPeopleQuery);
    const arrayOfIds = followingPeople.map(
        (eachUser)=> eachUser.following_user_id
    );
    return arrayOfIds;

};
//AuTHENTICATION TOKEN
const authentication = (request,response,next)=> {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if(authHeader){
        jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken){
        jwt.verify(jwtToken, "SECRET_KEY", (error, payload)=> {
            if(error) {
                response.status(401);
                response.send("Invalid JWT Token");

            }else{
                request.username = payload.username;
                request.userId = payload.userId;
                next();
            }
        });
    }else{
        response.status(401);
         response.send("Invalid JWT Token");
    }
};
//tweet access
const TweetAccessVerification = async (request,response,next) => {
    const {userId} = request;
    const {tweetId} = request.params;
    const getTweetQuery =`SELECT
    *
    FROM tweet INNER JOIN follower
    ON tweet.user_id = follower.following_user_id
    WHERE tweet_id =`${tweetId}`AND follower_user_id ='${userId}';`;
    const tweet = await db.get(getTweetQuery);
    if(tweet=== undefined){
        response.status(401);
        response.send("Invalid Request");

    }else{
        next();
    }
    
};
//api - 1
app.post("/register/",async(request,response)=>{
    const {username, password, name, gender} =request.body;
    const getUserQuery = `select * from user where username =`${username}``;
    const userDbDetails = await db.get(getUserQuery);
    //sc 1
    if (userDbDetails !== undefined){
        response.status(400);
        response.send("User already exists");
    }else{
        //sc 2
        if(password.length<6){
            response.status(400);
            response.send("Password is too short");
        }else{
      //sc 3
        const hashedPassword = await bcrypt.hash(password, 10);
        const createUserQuery = 'INSERT INTO user (username, password,name,gender)
        VALUES('${username}','${hashedPassword}','${name}','${gender}' )';
        await db.run(createUserQuery);
        response.send("User Created Successfully");
    }
}
});
//api2
app.post("/login/", async(request, response)=>{
    const {username, password } = request.body;
    const getUserQuery = `SELECT * FROM user WHERE userName='${username}'';`;
    const userDetails = await db.get(getUserQuery);
    if (userDbDetails !== undefined){
        const isPasswordCorrect = await bcrypt.compare(
            password,
            userDbDetails.password
        )
    };
        if (isPasswordCorrect) {
            const payload = {username, userId: userDbDetails.user_id};
            const jwtToken = jwt.sign(payload, "SECRET_KEY");
            response.send({jwtToken});
        }else{
            response.status(400);
            response.send("Invalid Password");
        }else{
             response.status(400);
            response.send("Invalid user");
        }
    
});
//api 3
app.get("/user/tweet/feed",authentication, async (request, response) => {
    const {username} = request;
    const followingPeopleIds = await getFollowingPeopleIdsOfUser(username);
    const getTweetQuery = `SELECT
    username, tweet, date_time as dateTime
    FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE 
    user.user_id IN (${followingPeopleIds})
    ORDER BY date_time DESC
    LIMIT 4;`;
    const tweets = await db.all(getTweetQuery);
    response.send(tweets);
});
//api 4
app.get("/user/following/", authentication, async (request, response)=>{
    const {username, userId} = request;
    const getFollowingUserQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE
   follower_user_id ='${userId}'`; 
});
//api 5
app.get("/user/followers/", authentication, async (request, response)=>{
    const {username, userId} = request;
    const getFollowersQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE
   following_user_id ='${userId}'`; 
   const followers = await db.all(getFollowersQuery);
   response.send(followers);
});
//api 6
app.get(
    "/tweets/:tweetId",
    authentication,
    TweetAccessVerification,
    async (request,response) => {
        const {username,userId}=request;
        const {tweetId} = request.params;
        const getTweetQuery = `SELECT tweet,
        (SELECT COUNT() FROM likely WHERE tweet_id ='${tweetId}' AS likes,
        (SELECT COUNT() FROM reply WHERE tweet_id ='${tweetId}' AS replies,
        date_time AS dateTime
        FROM tweet 
        WHERE tweet.tweet_id = '${tweetId}';
        `;
        const tweet = await db.get(getTweetQuery);
        response.send(tweet);
    }
);
//api 7
app.get(
    "/tweets/:tweetId/likes/",
    authentication,
    TweetAccessVerification,
    async (request,response) => {
    
        const {tweetId} = request.params;
        const getTweetQuery = `SELECT tweet,
       FROM user INNER JOIN like ON user.user_id = like.user_id
       WHERE tweet_id = '${tweetId}';
        `;
        const likedUsers = await db.get(getLikedQuery);
        const userArray = likedUsers.map((eachUser)=> eachUser,username);
        response.send({likes:userArray});
    }
    app.get(
    "/tweets/:tweetId/replies/",
    authentication,
    TweetAccessVerification,
    async (request,response) => {
        const {getLikedQuery} = request.params;
        const getLikedQuery = `SELECT name,reply
        FROM user INNER JOIN reply ON user.user_id = reply.user_id
        
        WHERE tweet.tweet_id = '${tweetId}';
        `;
        const tweet = await db.get(getRepliedQuery);
        response.send({replies:repliedUsers});
    }
};
//api 9
app.get("/user/tweets/",authentication, async (request, response) => {
    const {userId} = request;
    const getTweetQuery = `SELECT tweet,
    COUNT(DISTINCT like_id) as likes,
     COUNT(DISTINCT reply_id) as replies,
     date_time as dateTime
     FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
     LEFT JOIN like ON tweet.tweet_id = like.tweet_id
     WHERE tweet.user_id = '${userId}'
     GROUP BY tweet.tweet_id
    ;`;
    const tweets = await db.all(getTweetQuery);
    response.send(tweets);
});
//api 10
app.get("/user/tweets/",authentication, async (request, response) => {
    const {tweet} = request.body;
    const userId = parseInt(request.userId);
    const dateTime = new Date(). toJSON().substring(0,19).replace("T", " ");
    const createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES('${tweet}', '${userId}', ${dateTime})
    `;
    await db.run(createTweetQuery);
    response.send("Created a Tweet");
  
});
//api -11
app.get("/tweets/tweetId/",authentication, async (request, response) => {
    const {tweetId} = request.params;
    const {userId} = request;
    const getTheTweetQuery =`SELECT * FROM tweet WHERE user_id = '${userId}' AND tweet_Id = '${tweetId}';`;
    const tweet = await db.get(getTheTweetQuery);

    if (tweet=== undefined){
        response.status(401);
        response.send("Invalid Request");
    }else{
        const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id ='${tweetId}';`;
        await db.run(deleteTweetQuery);
        response.send("Tweet Removed");
    }
    
});
module.exports = app;
