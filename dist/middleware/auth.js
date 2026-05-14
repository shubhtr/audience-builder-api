import jwt from 'jsonwebtoken';
export const authorize = (roles) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token)
            return res.status(401).json({ message: "Unauthorized" });
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!roles.includes(decoded.role)) {
                return res.status(403).json({ message: "Forbidden: Insufficient Permissions" });
            }
            req.user = decoded;
            next();
        }
        catch (err) {
            res.status(401).json({ message: "Invalid Token" });
        }
    };
};
//# sourceMappingURL=auth.js.map