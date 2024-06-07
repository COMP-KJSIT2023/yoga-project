const mongoose = require('mongoose');

const InstructorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    availability: [
        {
            date: {
                type: String,
                required: true
            },
            timeslots: [
                {
                    type: String,
                    required: true
                }
            ]
        }
    ]
});

const Instructor = mongoose.model('Instructor', InstructorSchema);
module.exports = Instructor;
