const mongoose = require('mongoose')
const { DBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema

const User = new Schema({
  sName: { type: String, trim: true },
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })


const UserModel =  DBConnect.model('users', User)

module.exports = UserModel