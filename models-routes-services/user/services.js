const userAuthServices = {}

userAuthServices.logout = async (req, res) => {
    try {
        return res.status(200).json({ message: 'User logged out successfully' })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

module.exports = userAuthServices