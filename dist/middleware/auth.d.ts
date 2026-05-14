import type { Request, Response, NextFunction } from 'express';
export declare const authorize: (roles: ("ADMIN" | "PLANNER")[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map