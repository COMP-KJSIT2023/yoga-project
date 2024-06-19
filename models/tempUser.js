const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tempUserSchema = new Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        match: [/.+@.+\..+/, 'Please enter a valid email address']
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        maxlength: [50, 'First name should not exceed 50 characters'],
        match: [/^[a-zA-Z\s]+$/, 'First name should only contain letters and spaces']
    },
    middleName: {
        type: String,
        maxlength: [50, 'Middle name should not exceed 50 characters'],
        match: [/^[a-zA-Z\s]*$/, 'Middle name should only contain letters and spaces']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        maxlength: [50, 'Last name should not exceed 50 characters'],
        match: [/^[a-zA-Z\s]+$/, 'Last name should only contain letters and spaces']
    },
    dob: {
        type: Date,
        required: [true, 'Date of birth is required']
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        match: [/^\+?\d{10,15}$/, 'Please enter a valid mobile number']
    },
    emailVerificationCode: String,
    emailVerificationExpires: Date,
    mobileVerificationCode: String,
    mobileVerificationExpires: Date
});

module.exports = mongoose.model('TempUser', tempUserSchema);
