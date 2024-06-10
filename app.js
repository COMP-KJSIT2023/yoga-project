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
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

app.get("/contact", (req, res) => {
    res.render("contact.ejs");
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
            req.flash("success", "Welcome to Yoga.Fitnesse!");
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
    req.flash("success", "Welcome to Yoga.Fitnesse!");
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

app.get('/forgot', (req, res) => {
    res.render('users/forgot.ejs');
});

app.post('/forgot', async (req, res) => {
    try {
        const token = crypto.randomBytes(20).toString('hex');
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        const smtpTransport = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'masunavivek7208@gmail.com',
                pass: 'skay zvxq pqcg ykwg',
            },
        });

        const mailOptions = {
            to: user.email,
            from: 'masunavivek7208@gmail.com',
            subject: 'Password Reset',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.
            Please click on the following link, or paste this into your browser to complete the process: http://${req.headers.host}/reset/${token}
            If you did not request this, please ignore this email and your password will remain unchanged.`,
        };

        await smtpTransport.sendMail(mailOptions);
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        res.redirect('/forgot');
    } catch (err) {
        req.flash('error', 'Something went wrong. Please try again.');
        console.log(err);
        res.redirect('/forgot');
    }
});

app.get('/reset/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('users/reset.ejs', { token: req.params.token });
    } catch (err) {
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/forgot');
    }
});

app.post('/reset/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }

        if (req.body.password === req.body.confirm) {
            user.setPassword(req.body.password, async (err) => {
                if (err) {
                    req.flash('error', 'Something went wrong. Please try again.');
                    return res.redirect('/forgot');
                }
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                await user.save();
                req.logIn(user, (err) => {
                    if (err) {
                        req.flash('error', 'Something went wrong. Please try again.');
                        return res.redirect('/forgot');
                    }
                    req.flash('success', 'Success! Your password has been changed.');
                    res.redirect('/');
                });
            });
        } else {
            req.flash('error', 'Passwords do not match.');
            res.redirect('back');
        }
    } catch (err) {
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/forgot');
    }
});

app.listen(port, () => {
    console.log(`app is listening on port ${port}`);
});
