import express from "express";
import { admin } from "../firebaseAdmin";

export const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Missing authentication token." });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error("[Auth Middleware] ID Token verification failed:", error.message);
    return res.status(401).json({ error: "Unauthorized. Invalid authentication token." });
  }
};
