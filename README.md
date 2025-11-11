# PureBD Mart Backend

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green)](https://nodejs.org/) 
[![Express](https://img.shields.io/badge/Express-5.x-blue)](https://expressjs.com/) 
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-green)](https://www.mongodb.com/) 
[![License](https://img.shields.io/badge/License-ISC-yellow)](LICENSE)

Backend server for **PureBD Mart**, a simple e-commerce platform selling honey, dates, oils, fruits, fresh fish, and more. Built using **Node.js, Express, MongoDB, and NextAuth** for session-based authentication.

---

## Table of Contents

- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Folder Structure](#folder-structure)  
- [Getting Started](#getting-started)  
- [Environment Variables](#environment-variables)  
- [Running the Project](#running-the-project)  
- [API Routes](#api-routes)  
- [License](#license)  
- [Author](#author)  

---

## Features

- **User Roles:** `User` & `Admin`  
- **Authentication:** Email/password and Google login using NextAuth  
- **Products & Categories:** CRUD APIs for managing products and categories  
- **Orders:** Users can place orders without login; Admin can manage orders  
- **Email Notifications:** Nodemailer for order confirmations and delivery updates  
- **Cart:** Stores data in **localStorage** until checkout  
- **Cash on Delivery:** Only payment method  
- **Secure:** Environment variables for secrets and database credentials  
- **Image Uploads:** Cloudinary integration for product images  

---

## Tech Stack

- **Backend:** Node.js, Express.js  
- **Database:** MongoDB (Mongoose)  
- **Authentication:** NextAuth (session-based)  
- **Email:** Nodemailer  
- **File Uploads:** Multer + Cloudinary  
- **Other Tools:** Tailwind (frontend styling), slugify, bcryptjs  

---

## Folder Structure

PureBD_Mart_Backend/
│
├─ src/
│   ├─ config/
│   │   └─ db.js              # MongoDB connection
│   ├─ controllers/           # API logic for each route
│   ├─ models/                # Mongoose models
│   ├─ routes/                # Express routes
│   └─ utils/                 # Utility functions
│
├─ app.js                     # Express app setup
├─ index.js                   # Server entry point
├─ package.json
├─ .env                       # Environment variables (not committed)
└─ .gitignore

---

## Getting Started

### Prerequisites

- Node.js v18+  
- npm  
- MongoDB Atlas account or local MongoDB instance  
- Cloudinary account (optional for image uploads)  

---

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/parvejme24/PureDB_Mart_Backend.git
cd PureBD_Mart_Backend



Install dependencies


npm install



Create a .env file at the root:


# MongoDB Connection
MONGODB_URI=mongodb+srv://<DB_USER>:<DB_PASS>@cluster0.mongodb.net/PureDB_Mart_DB

# NextAuth Secret (for session encryption)
NEXTAUTH_SECRET=your_super_secure_secret_here

# Cloudinary (optional, for product images)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret


Running the Project
Development mode with nodemon:
npm run dev

Production mode:
npm start

Server will run at: http://localhost:5050

API Routes
RouteMethodDescription/api/authPOSTUser login / Google login via NextAuth/api/productsGETGet all products/api/productsPOSTAdd new product (Admin only)/api/products/:idGETGet single product/api/products/:idPUTUpdate product (Admin only)/api/products/:idDELETEDelete product (Admin only)/api/categoriesGETGet all categories/api/categoriesPOSTAdd new category (Admin only)/api/ordersGETGet all orders (Admin only)/api/ordersPOSTPlace new order/api/orders/:idPATCHUpdate order status (Admin only)

Note: Cart data is stored in localStorage on the frontend. Orders are saved to the database only when the user places an order.


Environment Variables
Make sure to configure all variables in .env:
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_SECRET=your_nextauth_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret


License
This project is licensed under the ISC License.

Author
Md Parvej


GitHub: parvejme24


Email: your-email@example.com



✨ Built with ❤️ by Md Parvej

---

This is a **complete, professional README** that is ready to push to GitHub.  

It includes:

- Badges  
- Features & Tech Stack  
- Folder Structure  
- Setup Instructions  
- API Documentation  
- Environment variables  
- Author & License  

---

If you want, I can also make a **fancier version with images/icons for API routes and workflow diagram**, which looks **very attractive for clients**.  

Do you want me to do that?
