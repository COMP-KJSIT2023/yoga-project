require('dotenv').config()

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
const TempUser = require('./models/tempUser.js');
const Gallery = require("./models/gallery.js");
const { saveRedirectUrl } = require('./middleware.js');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
// const auth = require('./firebase.js');
const multer  = require('multer');
const {storage} = require('./cloudConfig.js');
const upload = multer({ storage });

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

// app.get("/backend", (req, res) => {
//     res.render("backend.ejs");
// });

app.get('/signup', (req, res) => {
    res.render("users/signup.ejs");
});

app.get('/gallery', async (req, res) => {
    const allImages = await Gallery.find({});
    res.render("gallery/gallery.ejs", { allImages });
});

app.get('/gallery/new', (req, res) => {
    res.render("gallery/new.ejs");
});

app.post('/gallery', upload.single('image'), async (req, res) => {
    try {
        let url = req.file.path;
        let filename = req.file.filename;
        let { description } = req.body;
        const newImage = new Gallery({ description, image: { url, filename } });

        await newImage.save();
        req.flash("success", "New Image Uploaded!");
        res.redirect("/gallery");
    } catch (err) {
        console.error(err);
        req.flash("error", "An error occurred while uploading the image.");
        res.redirect("/gallery");
    }
});

// Email setup
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Twilio setup
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Function to send email
async function sendVerificationEmail(to, code) {
    const mailOptions = {
        to,
        from: process.env.EMAIL_USER,
        subject: 'Email Verification',
        text: `Your verification code is ${code}`
    };

    for (let i = 0; i < 3; i++) { // retry 3 times
        try {
            await transporter.sendMail(mailOptions);
            return;
        } catch (error) {
            console.error(`Attempt ${i + 1} to send email failed:`, error);
            if (i === 2) throw error;
        }
    }
}

const sendVerificationMobile = async (mobile) => {
    try {
        // Make sure the mobile number is in E.164 format (e.g., +1234567890)
        const verificationId = await auth.verifyPhoneNumber(mobile);
        return { status: 200, data: { verificationId } };
    } catch (error) {
        return { status: 400, error: error.message };
    }
};
// Function to send SMS
// async function sendVerificationSMS(to, code) {
//     await twilioClient.messages.create({
//         body: `Your verification code is ${code}`,
//         from: process.env.TWILIO_PHONE_NUMBER,
//         to
//     });
// }

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/signup', async (req, res, next) => {
    const { username, email, password, first_name, middle_name, last_name, dob, mobile } = req.body;

    try {
        const emailVerificationCode = generateVerificationCode();
        const mobileVerificationCode = generateVerificationCode();

        const emailVerificationExpires = Date.now() + 3600000;
        const mobileVerificationExpires = Date.now() + 3600000;

        let newTempUser = new TempUser({
            email,
            username,
            password,
            firstName: first_name,
            middleName: middle_name,
            lastName: last_name,
            dob: new Date(dob),
            mobile,
            emailVerificationCode,
            emailVerificationExpires,
            mobileVerificationCode,
            mobileVerificationExpires
        });

        await newTempUser.save();

        await sendVerificationEmail(email, emailVerificationCode);
        const result = await sendVerificationMobile(mobile);
        if (result.status === 200) {
            req.flash('success', 'Verification codes sent to your email and mobile. Please verify to complete registration.');
            localStorage.setItem('verificationId', result.data.verificationId);
            res.redirect('/verify');
        } else {
            req.flash('error', result.error);
            res.redirect('/signup');
        }
    } catch (e) {
        req.flash('error', e.message);
        console.log(e);
        await TempUser.deleteMany({ email, mobile });
        res.redirect('/signup');
    }
});

app.get('/verify', (req, res) => {
    res.render('users/verify.ejs');
});

app.post('/verify', async (req, res) => {
    const { email, emailCode, mobile, otp } = req.body;
    const verificationId = localStorage.getItem('verificationId');

    if (!verificationId) {
        req.flash('error', 'Verification ID not found.');
        return res.redirect('/verify');
    }

    try {
        const tempUser = await TempUser.findOne({ email, mobile });

        if (!tempUser) {
            req.flash('error', 'User not found.');
            return res.redirect('/verify');
        }

        // Check email verification code and expiry
        if (tempUser.emailVerificationCode === emailCode && tempUser.emailVerificationExpires > Date.now()) {
            tempUser.isEmailVerified = true;
        } else {
            req.flash('error', 'Invalid or expired email verification code.');
            return res.redirect('/verify');
        }

        // Verify the OTP using the verificationId
        const phoneAuthProvider = new admin.auth.PhoneAuthProvider(auth);
        const credential = phoneAuthProvider.credential(verificationId, otp);

        const userRecord = await admin.auth().verifyIdToken(credential);

        if (userRecord.phone_number === mobile) {
            tempUser.isMobileVerified = true;

            const newUser = new User({
                email: tempUser.email,
                username: tempUser.username,
                firstName: tempUser.firstName,
                middleName: tempUser.middleName,
                lastName: tempUser.lastName,
                dob: tempUser.dob,
                mobile: tempUser.mobile,
                isEmailVerified: tempUser.isEmailVerified,
                isMobileVerified: tempUser.isMobileVerified,
            });

            let registeredUser = await User.register(newUser, tempUser.password);

            await TempUser.deleteMany({ email, mobile });

            req.flash('success', 'Email and Mobile verified successfully. You can now log in.');
            res.redirect('/login');
        } else {
            req.flash('error', 'Invalid OTP or mobile number.');
            res.redirect('/verify');
        }
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/verify');
    }
});

app.get('/login', (req, res) => {
    res.render("users/login.ejs");
});

app.post('/login', saveRedirectUrl, async (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('error', 'Invalid username or password.');
            return res.redirect('/login');
        }

        if (!user.isEmailVerified || !user.isMobileVerified) {
            req.flash('error', 'Please verify your email and mobile to log in.');
            return res.redirect('/verify');
        }

        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to Yoga.Fitnesse!");
            let redirectUrl = res.locals.redirectUrl || "/";
            res.redirect(redirectUrl);
        });
    })(req, res, next);
});

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
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
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const smtpTransport = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
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
