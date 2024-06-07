const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    instructorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Instructor',
        required: true
    },
    date: {
        type: String,
        required: true
    },
    timeslot: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

const Booking = mongoose.model('Booking', BookingSchema);
module.exports = Booking;
