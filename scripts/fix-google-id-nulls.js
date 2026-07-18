require('dotenv').config()
const { DBConnect } = require('../database/mongoose')

DBConnect.asPromise()
  .then(async () => {
    const col = DBConnect.collection('users')
    const result = await col.updateMany(
      { sGoogleId: null },
      { $unset: { sGoogleId: '' } }
    )
    console.log('Unset sGoogleId nulls:', result.modifiedCount)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
