import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import { BaseQuery, NewProductRequestBody, SearchRequestQuery } from "../types/types.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { myCache } from "../app.js";
import {
    deleteFromCloudinary,
    invalidateCache,
    uploadToCloudinary,
  } from "../utils/features.js";
// import {faker} from "@faker-js/faker";



//Revalidate Cache on New, Update, Delete Product, New Order
export const getLatestProducts = TryCatch(async (req, res, next) => {

    let products;

    if(myCache.has("latest-products")){
        products = JSON.parse(myCache.get("latest-products") as string);
    }
    else{
        products = await Product.find({}).sort({createdAt: -1}).limit(5);
        myCache.set("latest-products", JSON.stringify(products));
    }
    
    return res.status(200).json({
        success: true,
        products,
    });

} );

//Revalidate Cache on New, Update, Delete Product, New Order
export const getAllCategories = TryCatch(async (req, res, next) => {

    let categories;

    if(myCache.has("categories")){
        categories = JSON.parse(myCache.get("categories") as string);
    }
    else{
        categories = await Product.distinct("category");
        myCache.set("categories", JSON.stringify(categories));
    };

    return res.status(200).json({
        success: true,
        categories,
    });

} );

//Revalidate Cache on New, Update, Delete Product, New Order
export const getAdminProducts = TryCatch(async (req, res, next) => {

    let products;
    if(myCache.has("all-products")){
        products = JSON.parse(myCache.get("all-products") as string);        
    }
    else{
        products = await Product.find({});
        myCache.set("all-products", JSON.stringify(products));
    }


    return res.status(200).json({
        success: true,
        products,
    });

} );

export const getSingleProduct = TryCatch(async (req, res, next) => {

    let product;

    const id = req.params.id;

    if(myCache.has(`product-${id}`)){
        product = JSON.parse(myCache.get(`product-${id}`) as string);
    }
    else{
        product = await Product.findById(id);
        if(!product) return next(new ErrorHandler("Product not found", 404));
        myCache.set(`product-${id}`, JSON.stringify(product));
    };
 

    return res.status(200).json({
        success: true,
        product,
    });

} );


export const newProduct = TryCatch(async(req: Request<{},{},NewProductRequestBody>, res, next) => {

    const {name, price, stock, category} = req.body;

    const photos = req.files as Express.Multer.File[] | undefined;

    if(!photos) return next(new ErrorHandler("Please add Photo", 400));

    if (photos.length < 1)
        return next(new ErrorHandler("Please add atleast one Photo", 400));
  
    if (photos.length > 5)
        return next(new ErrorHandler("You can only upload 5 Photos", 400));
    
    if (!name || !price || !stock || !category) {
        return next(new ErrorHandler("Please enter all fields", 400));
    }
    console.log("Hello");

    const photosURL = await uploadToCloudinary(photos);

    console.log(photosURL);

    await Product.create({
        name,
        price,
        stock,
        category: category.toLowerCase(),
        photos: photosURL,
    });


    invalidateCache({product: true, admin: true});

    return res.status(201).json({
        success: true,
        message: "Product Created Successfully"
    });

} );

export const updateProduct = TryCatch(async(req, res, next) => {

    const {id} = req.params;
    const {name, price, stock, category} = req.body;
    const photos = req.files as Express.Multer.File[] | undefined;
    const product = await Product.findById(id);

    if(!product) return next(new ErrorHandler("Product not found", 404));

    

    if (photos && photos.length > 0) {

        const photosURL = await uploadToCloudinary(photos);

        const ids = product.photos.map((photo) => photo.public_id);

        await deleteFromCloudinary(ids);

        //product.photos = photosURL;
        product.updateOne({$set: {photos: photosURL}})
    }

    if(name) product.name = name;
    if(price) product.price = price;
    if(stock) product.stock = stock;
    if(category) product.category = category;

    await product.save();

    invalidateCache({product: true, productId: String(product._id), admin: true});


    return res.status(200).json({
        success: true,
        message: "Product Updated Successfully"
    });

} );


export const deleteProduct = TryCatch(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if(!product) return next(new ErrorHandler("Product not found", 404));

    const ids = product.photos.map((photo) => photo.public_id);

    await deleteFromCloudinary(ids);

    await product.deleteOne();

    invalidateCache({product: true, productId: String(product._id), admin: true});

    return res.status(200).json({
        success: true,
        message: "Product Deleted Successfully"
    });

} );

export const getAllProducts = TryCatch(async (req: Request<{}, {}, {}, SearchRequestQuery>, res, next) => {

    const {search, sort, category, price} = req.query;

    const page = Number(req.query.page) || 1;

    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = limit * (page - 1);

    const baseQuery: BaseQuery = {};

    if(search) 
        baseQuery.name = {
            $regex:search,
            $options: "i",
        };

    if(price) 
        baseQuery.price ={
            $lte: Number(price),
        };

    if(category)
        baseQuery.category = category;


    const [products, filteredOnlyProduct] = await Promise.all([
        Product.find(baseQuery)
        .sort(sort && {price: sort === "asc" ? 1 : -1} )
        .limit(limit)
        .skip(skip),
        Product.find(baseQuery)
    ])

 

    const totalPage = Math.ceil(filteredOnlyProduct.length / limit);

    return res.status(200).json({
        success: true,
        products,
        totalPage,
    });

} );

// const generateRandomProducts = async (count: number = 10) => {
//     const products = [];

//     for (let i = 0; i < count; i++) {
//             const product = {
//               name: faker.commerce.productName(),
//               photo: "uploads\\a9bb863b-bfc5-4d0a-bce9-b3db75a08b6c.jfif",
//               price: faker.commerce.price({ min: 1500, max: 80000, dec: 0 }),
//               stock: faker.commerce.price({ min: 0, max: 100, dec: 0 }),
//               category: faker.commerce.department(),
//               createdAt: new Date(faker.date.past()),
//               updatedAt: new Date(faker.date.recent()),
//               __v: 0,
//             };
        
//             products.push(product);   
//     };

//     await Product.create(products);

//     console.log({success: true});

// };

// const deleteRandomsProducts = async (count: number = 10) => {
//   const products = await Product.find({}).skip(2);

//   for (let i = 0; i < products.length; i++) {
//     const product = products[i];
//     await product.deleteOne();
//   }

//   console.log({ success: true });
// };