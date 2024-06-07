const express = require("express");
const app = express();
const path = require("path");
const port = 8080;
const mongoose = require('mongoose');
const methodOverride = require("method-override");
const bodyParser = require('body-parser');
const cors = require('cors');
const ejsMate = require("ejs-mate");
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require("./models/user.js");
const { saveRedirectUrl } = require('./middleware.js');

const MONGO_URL = 'mongodb://127.0.0.1:27017/yoga-website';

main()
    .then((res) => {
        console.log("Connected to DB");
    })
    .catch(err => console.log(err));

async function main() {
    await mongoose.connect(MONGO_URL);
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "/public/css")));
app.use(express.static(path.join(__dirname, "/public/js")));
app.use(express.static(path.join(__dirname, "/public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);

const store = MongoStore.create({
    mongoUrl: MONGO_URL,
    crypto: {
        secret: "mysecretcode",
    },
    touchAfter: 24 * 3600,
});

store.on("error", () => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
    store,
    secret: "mysecretcode",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
};

app.use(session(sessionOptions));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/about", (req, res) => {
    res.render("about.ejs");
});

app.get('/signup', (req, res) => {
    res.render("users/signup.ejs");
});

app.post('/signup', async (req, res) => {
    try {
        let { username, email, password } = req.body;
        let newUser = new User({email, username});
        let registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if(err) {
                next(err);
            }
            req.flash("success", "Welcome to Wanderlust!");
            res.redirect("/");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
});

app.get('/login', (req, res) => {
    res.render("users/login.ejs");
});

app.post('/login', saveRedirectUrl, passport.authenticate("local", { failureRedirect: '/login', failureFlash: true }),  async (req, res) => {
    req.flash("success", "Welcome back!");
    let redirectUrl = res.locals.redirectUrl || "/";
    res.redirect(redirectUrl);
});

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if(err) {
            next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/");
    });
});

app.listen(port, () => {
    console.log(`app is listening on port ${port}`);
});
