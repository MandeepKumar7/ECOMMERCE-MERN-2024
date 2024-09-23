import express from "express";

import { adminOnly } from "../middlewares/auth.js";
import { deleteProduct, getAdminProducts, getAllCategories, getAllProducts, getLatestProducts, getSingleProduct, newProduct, updateProduct } from "../controllers/product.js";
import { multiUpload } from "../middlewares/multer.js";

const app = express.Router();

// Create New Product - /api/v1/product/new
app.post("/new", adminOnly, multiUpload, newProduct);

// Get all products with filters - /api/v1/product/all
app.get("/all", getAllProducts);

// Get last 5 Products - /api/v1/product/latest
app.get("/latest", getLatestProducts);

// Get all unique Categories - /api/v1/product/categories
app.get("/categories", getAllCategories);

//Get all Products - /api/v1/product/admin-products
app.get("/admin-products", adminOnly, getAdminProducts );

// Get, Update, Delete Product
app.route("/:id").get(getSingleProduct).put(adminOnly,multiUpload, updateProduct).delete(adminOnly,deleteProduct);

export default app;