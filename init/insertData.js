const mongoose = require('mongoose');
const Instructor = require('../models/Instructor');
const Booking = require('../models/Booking');
const User = require('../models/User');

const MONGO_URL = 'mongodb://127.0.0.1:27017/yoga-website';

async function main() {
    await mongoose.connect(MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
}

main()
    .then(() => {
        console.log("Connected to DB");
        return insertData();
    })
    .catch(err => console.log(err))
    .finally(() => mongoose.connection.close());

async function insertData() {
    try {
        // Insert Users (to be used for bookings)
        const user = new User({ email: 'test@example.com', username: 'testuser' });
        await User.register(user, 'password123');
        console.log('User inserted');

        // Insert Instructors
        const instructors = [
            { name: 'Alice', availability: [{ date: '2024-06-10', timeslots: ['08:00', '10:00'] }] },
            { name: 'Bob', availability: [{ date: '2024-06-10', timeslots: ['14:00', '16:00'] }] }
        ];

        await Instructor.deleteMany();
        await Instructor.insertMany(instructors);
        console.log('Instructors inserted');

        // Insert Bookings
        const instructorAlice = await Instructor.findOne({ name: 'Alice' });
        const instructorBob = await Instructor.findOne({ name: 'Bob' });

        const bookings = [
            { instructorId: instructorAlice._id, date: '2024-06-10', timeslot: '08:00', userId: user._id },
            { instructorId: instructorBob._id, date: '2024-06-10', timeslot: '14:00', userId: user._id }
        ];

        await Booking.deleteMany();
        await Booking.insertMany(bookings);
        console.log('Bookings inserted');
    } catch (error) {
        console.error('Error inserting data:', error);
    }
}
