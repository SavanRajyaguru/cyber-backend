const enums = {
  eStatus: {
    value: ['Y', 'N'],
    map: {
      ACTIVE: 'Y',
      INACTIVE: 'N'
    }
  },
  eRole: {
    value: ['ADMIN', 'USER', 'GUEST'],
    map: {
      ADMIN: 'ADMIN',
      USER: 'USER',
      GUEST: 'GUEST'
    }
  },
  eAuthProvider: {
    value: ['EMAIL', 'GOOGLE', 'GUEST'],
    map: {
      EMAIL: 'EMAIL',
      GOOGLE: 'GOOGLE',
      GUEST: 'GUEST'
    }
  }
}

module.exports = enums
