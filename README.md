<div align="center">

# 🍯 PureBD Mart — Backend

**A robust REST API backend for a Bangladeshi e-commerce platform, built with Node.js, Express, and MongoDB.**

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Image_Uploads-3448C5?style=flat-square&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow?style=flat-square)](#)

[Frontend Repo](#) · [Live API](#) · [Report Bug](#)

</div>

---

## 📌 Overview

PureBD Mart Backend is the REST API server powering the PureBD Mart e-commerce platform — a Bangladeshi store specializing in honey, dates, oils, fruits, fresh fish, and more. It handles authentication, product and category management, order processing, image uploads, and transactional email notifications.

---

## ✨ Features

| Area                       | Details                                                      |
| -------------------------- | ------------------------------------------------------------ |
| 🔐 **Authentication**      | Email/password and Google OAuth via NextAuth (session-based) |
| 👤 **User Roles**          | `User` and `Admin` role-based access control                 |
| 📦 **Product Management**  | Full CRUD for products and categories (Admin only)           |
| 🧾 **Order Management**    | Guest checkout support; Admin can update order status        |
| 📧 **Email Notifications** | Nodemailer for order confirmations and delivery updates      |
| 🖼️ **Image Uploads**       | Multer + Cloudinary for cloud-based product image storage    |
| 📝 **Request Logging**     | Morgan middleware with Apache-style combined logging         |
| 💳 **Payment**             | Cash on Delivery (COD) only                                  |
| 🔒 **Security**            | Environment-variable-based secret management                 |

---

## 🛠️ Tech Stack

### Core

- **Runtime:** Node.js 18.x
- **Framework:** Express.js 5.x
- **Database:** MongoDB 8.x (Mongoose ODM)

### Integrations

- **Authentication:** NextAuth.js (session-based)
- **Email:** Nodemailer
- **File Uploads:** Multer + Cloudinary
- **Logging:** Morgan

### Utilities

- `bcryptjs` — Password hashing
- `slugify` — URL-friendly slugs for products
- `dotenv` — Environment variable management

---

## 📁 Project Structure

```
PureBD_Mart_Backend/
├── src/
│   ├── config/
│   │   └── db.js              # MongoDB connection setup
│   ├── controllers/           # Route handler logic
│   ├── models/                # Mongoose schemas & models
│   ├── routes/                # Express route definitions
│   └── utils/                 # Helper functions & utilities
├── app.js                     # Express app configuration
├── index.js                   # Server entry point
├── .env                       # Environment variables (not committed)
├── .gitignore
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm**
- **MongoDB** (Atlas or local instance)
- **Cloudinary** account (for image uploads)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/parvejme24/PureDB_Mart_Backend.git
cd PureBD_Mart_Backend
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file in the root directory:

```env
# Server
PORT=5050

# MongoDB
MONGODB_URI=mongodb+srv://<DB_USER>:<DB_PASS>@cluster0.mongodb.net/PureDB_Mart_DB

# NextAuth
NEXTAUTH_SECRET=your_super_secure_secret_here

# Cloudinary (for product image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

**4. Start the server**

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:5050`

---

## 📡 API Reference

### Auth

| Method | Endpoint    | Description                            |
| ------ | ----------- | -------------------------------------- |
| `POST` | `/api/auth` | User login / Google login via NextAuth |

### Products

| Method   | Endpoint            | Access | Description          |
| -------- | ------------------- | ------ | -------------------- |
| `GET`    | `/api/products`     | Public | Get all products     |
| `GET`    | `/api/products/:id` | Public | Get a single product |
| `POST`   | `/api/products`     | Admin  | Create a new product |
| `PUT`    | `/api/products/:id` | Admin  | Update a product     |
| `DELETE` | `/api/products/:id` | Admin  | Delete a product     |

### Categories

| Method | Endpoint          | Access | Description           |
| ------ | ----------------- | ------ | --------------------- |
| `GET`  | `/api/categories` | Public | Get all categories    |
| `POST` | `/api/categories` | Admin  | Create a new category |

### Orders

| Method  | Endpoint          | Access | Description                       |
| ------- | ----------------- | ------ | --------------------------------- |
| `POST`  | `/api/orders`     | Public | Place a new order (guest allowed) |
| `GET`   | `/api/orders`     | Admin  | Get all orders                    |
| `PATCH` | `/api/orders/:id` | Admin  | Update order status               |

> **Note:** Cart data is managed on the frontend via `localStorage` and only persisted to the database when an order is placed.

---

## 📊 Request Logging

Morgan is configured with the **combined** (Apache-style) log format, capturing:

```
::1 - - [05/Jan/2026:16:30:00 +0000] "GET /api/products HTTP/1.1" 200 45 "-" "PostmanRuntime/7.39.0"
```

This provides visibility into IP addresses, request methods, status codes, response times, and user agents — useful for debugging, monitoring, and detecting suspicious activity.

---

## 🔑 Environment Variables

| Variable                | Required | Description                            |
| ----------------------- | -------- | -------------------------------------- |
| `PORT`                  | No       | Server port (default: `5050`)          |
| `MONGODB_URI`           | ✅       | MongoDB connection string              |
| `NEXTAUTH_SECRET`       | ✅       | Secret for NextAuth session encryption |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary cloud name                  |
| `CLOUDINARY_API_KEY`    | Optional | Cloudinary API key                     |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret                  |
| `SMTP_HOST`             | Optional | SMTP server host                       |
| `SMTP_PORT`             | Optional | SMTP server port                       |
| `SMTP_USER`             | Optional | SMTP username                          |
| `SMTP_PASS`             | Optional | SMTP app password                      |

---

## 📜 Available Scripts

```bash
npm run dev    # Start with nodemon (hot reload)
npm start      # Start in production mode
```

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">

Built with ❤️ by [Md Parvej](https://github.com/parvejme24) · [parvejme24@gmail.com](mailto:parvejme24@gmail.com)

</div>
