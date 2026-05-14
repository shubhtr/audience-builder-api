import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authorize = (roles: ('ADMIN' | 'PLANNER')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (!roles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden: Insufficient Permissions" });
      }
      (req as any).user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: "Invalid Token" });
    }
  };
};
