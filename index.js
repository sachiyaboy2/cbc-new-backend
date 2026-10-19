import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

// =====================================================
// ROUTERS
// =====================================================

import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";
import cartRouter from "./routes/cartRouter.js";
import customOrderRouter from "./routes/customOrderRouter.js";
import measurementRouter from "./routes/measurementRouter.js";
import adminUserRouter from "./routes/adminUserRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";
import paymentRouter from "./routes/paymentRouter.js";


// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

dotenv.config();


// =====================================================
// REQUIRED ENV CHECK
// =====================================================

if (!process.env.MONGO_URI) {
  throw new Error(
    "MONGO_URI is missing from environment variables",
  );
}

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is missing from environment variables",
  );
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must be at least 32 characters long",
  );
}


// =====================================================
// EXPRESS APP
// =====================================================

const app = express();


// =====================================================
// RENDER / PROXY
// =====================================================

// Render runs the app behind a reverse proxy.
// Useful for correct IP / HTTPS information later.
app.set("trust proxy", 1);


// =====================================================
// CORS
// =====================================================
//
// Example:
// CORS_ORIGINS=http://localhost:5173,https://naricraft.com
//
// If CORS_ORIGINS is not set,
// FRONTEND_URL will be used.
//

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) =>
    origin.trim().replace(/\/+$/, ""),
  )
  .filter(Boolean);


app.use(
  cors({
    origin: function (origin, callback) {
      // -------------------------------------------------
      // No Origin header:
      //
      // Allow server-to-server requests such as
      // PayHere notify_url callbacks,
      // Postman, curl, etc.
      // -------------------------------------------------

      if (!origin) {
        callback(null, true);

        return;
      }

      const normalizedOrigin =
        origin.replace(/\/+$/, "");

      if (
        allowedOrigins.includes(
          normalizedOrigin,
        )
      ) {
        callback(null, true);

        return;
      }

      callback(
        new Error(
          "Not allowed by CORS",
        ),
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  }),
);


// =====================================================
// BODY PARSERS
// =====================================================

// Normal React / JSON API requests
app.use(
  express.json({
    limit: "2mb",
  }),
);


// PayHere notify_url sends:
// application/x-www-form-urlencoded
app.use(
  express.urlencoded({
    extended: false,
    limit: "2mb",
  }),
);


// =====================================================
// HEALTH CHECK
// =====================================================
//
// Useful for Render and browser testing.
//
// GET:
// https://YOUR-BACKEND.onrender.com/health
//

app.get("/health", (req, res) => {
  const mongoConnected =
    mongoose.connection.readyState === 1;

  res.status(200).json({
    status: "ok",

    service: "NariCraft API",

    database: mongoConnected
      ? "connected"
      : "connecting",
  });
});


// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    message:
      "NariCraft Backend API is running",
  });
});


// =====================================================
// AUTH MIDDLEWARE
//
// Token exists:
// verify token and attach decoded user to req.user.
//
// No token:
// continue.
//
// This is important because public endpoints
// such as PayHere notify_url do NOT send our JWT.
// =====================================================

app.use((req, res, next) => {
  let token =
    req.header(
      "Authorization",
    );


  // =========================================
  // NO TOKEN
  // =========================================

  if (!token) {
    next();

    return;
  }


  // =========================================
  // BEARER TOKEN
  // =========================================

  token =
    token.replace(
      /^Bearer\s+/i,
      "",
    );


  if (!token) {
    res.status(401).json({
      message:
        "Invalid authorization token",
    });

    return;
  }


  // =========================================
  // VERIFY
  // =========================================

  try {
    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET,
      );


    req.user =
      decoded;


    next();
  } catch (err) {
    res.status(401).json({
      message:
        "Invalid or expired token",
    });
  }
});


// =====================================================
// API ROUTES
// =====================================================

app.use(
  "/api/users",
  userRouter,
);

app.use(
  "/api/products",
  productRouter,
);

app.use(
  "/api/orders",
  orderRouter,
);

app.use(
  "/api/cart",
  cartRouter,
);

app.use(
  "/api/custom-orders",
  customOrderRouter,
);

app.use(
  "/api/measurements",
  measurementRouter,
);

app.use(
  "/api/admin/users",
  adminUserRouter,
);

app.use(
  "/api/admin/dashboard",
  dashboardRouter,
);

app.use(
  "/api/payments",
  paymentRouter,
);


// =====================================================
// 404
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    message:
      "API route not found",
  });
});


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (
    err,
    req,
    res,
    next,
  ) => {
    // =========================================
    // CORS
    // =========================================

    if (
      err.message ===
      "Not allowed by CORS" 
    ) {
      res.status(403).json({
        message:
          "Origin not allowed",
      });

      return;
    }


    // =========================================
    // OTHER ERRORS
    // =========================================

    console.error(
      "Unhandled Server Error:",
      err.message,
    );


    res.status(500).json({
      message:
        "Internal server error",
    });
  },
);


// =====================================================
// SERVER
// =====================================================
//
// Local:
// PORT falls back to 5000.
//
// Render:
// Render supplies process.env.PORT.
//

const PORT =
  process.env.PORT ||
  5000;


const server =
  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `NariCraft API running on port ${PORT}`,
      );
    },
  );


// =====================================================
// MONGODB
// =====================================================
//
// Start HTTP server first so Render can detect
// the port quickly.
//
// Then connect MongoDB.
//

mongoose
  .connect(
    process.env.MONGO_URI,
  )
  .then(() => {
    console.log(
      "Connected to MongoDB",
    );
  })
  .catch((err) => {
    console.error(
      "MongoDB Connection Error:",
      err.message,
    );
  });


// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown(
  signal,
) {
  console.log(
    `${signal} received. Shutting down...`,
  );

  server.close(
    async () => {
      try {
        await mongoose
          .connection
          .close();

        console.log(
          "MongoDB connection closed",
        );
      } catch (err) {
        console.error(
          "MongoDB shutdown error:",
          err.message,
        );
      }

      process.exit(0);
    },
  );
}


process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM",
    ),
);

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT",
    ),
);