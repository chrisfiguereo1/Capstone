import jwt_decode from 'jwt-decode'

const getUserInfo = () => {
    const accessToken = localStorage.getItem("accessToken")
    if(!accessToken) return undefined
    try {
        return jwt_decode(accessToken)
    } catch (error) {
        localStorage.removeItem("accessToken")
        return undefined
    }
}

export default getUserInfo
