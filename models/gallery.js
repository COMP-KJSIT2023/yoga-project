const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gallerySchema = new Schema({
    description: {
        type: String,
        required: true,
    },
    image: {
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        },
    },
});

const Gallery = mongoose.model("Gallery", gallerySchema);

module.exports = Gallery;
