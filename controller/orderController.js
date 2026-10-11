import Order from "../models/order.js";
import Product from "../models/product.js";
import { isAdmin } from "./userController.js";


export async function createOrder(req, res) {

  try {

    // =====================================================
    // CHECK USER
    // =====================================================

    const user = req.user;


    if (user == null) {

      res.status(401).json({
        message: "Unauthorized",
      });

      return;

    }



    // =====================================================
    // GET LAST ORDER
    // =====================================================

    const lastOrder = await Order
      .findOne()
      .sort({ createdAt: -1 });



    // =====================================================
    // CREATE NEW ORDER ID
    // =====================================================

    let newOrderId = "NC000000001";


    if (lastOrder && lastOrder.orderId) {

      const lastOrderIdInString =
        lastOrder.orderId;


      const lastOrderNumberInString =
        lastOrderIdInString.replace(
          "NC",
          ""
        );


      const lastOrderNumber =
        parseInt(
          lastOrderNumberInString,
          10
        );


      const newOrderNumber =
        lastOrderNumber + 1;


      const newOrderNumberInString =
        newOrderNumber
          .toString()
          .padStart(9, "0");


      newOrderId =
        "NC" + newOrderNumberInString;

    }



    // =====================================================
    // CUSTOMER DETAILS
    // =====================================================

    let customerName =
      req.body.fullName;


    if (
      customerName == null ||
      customerName.trim() === ""
    ) {

      customerName =
        user.fullName ||
        user.firstName ||
        "";

    }



    let customerPhone =
      req.body.phone;


    if (
      customerPhone == null ||
      customerPhone.trim() === ""
    ) {

      customerPhone =
        user.phone || "";

    }



    // =====================================================
    // VALIDATE CUSTOMER DETAILS
    // =====================================================

    if (
      customerName === "" ||
      customerPhone === "" ||
      !req.body.address ||
      !req.body.city ||
      !req.body.district
    ) {

      res.status(400).json({
        message:
          "Customer and delivery details are required",
      });

      return;

    }



    // =====================================================
    // GET PRODUCTS FROM REQUEST
    // =====================================================

    const itemsInRequest =
      req.body.products;


    if (itemsInRequest == null) {

      res.status(400).json({
        message: "Products are required",
      });

      return;

    }



    if (
      !Array.isArray(itemsInRequest) ||
      itemsInRequest.length === 0
    ) {

      res.status(400).json({
        message:
          "Products must be a non-empty array",
      });

      return;

    }



    // =====================================================
    // PREPARE PRODUCTS FOR ORDER
    // =====================================================

    const productsToBeAdded = [];

    let total = 0;



    for (
      let i = 0;
      i < itemsInRequest.length;
      i++
    ) {

      const item =
        itemsInRequest[i];


      // ============================================
      // VALIDATE QUANTITY
      // ============================================

      const quantity =
        Number(item.quantity);


      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {

        res.status(400).json({
          message:
            "Product quantity must be at least 1",
          productId:
            item.productId,
        });

        return;

      }



      // ============================================
      // FIND PRODUCT
      // ============================================

      const product =
        await Product.findOne({

          productId:
            item.productId,

        });



      if (product == null) {

        res.status(400).json({

          code: "NOT_FOUND",

          message:
            "Product not found",

          productId:
            item.productId,

        });

        return;

      }



      // ============================================
      // CHECK STOCK
      // ============================================

      if (
        product.labelNo < quantity
      ) {

        res.status(400).json({

          code: "STOCK",

          message:
            "Product does not have enough stock",

          productId:
            item.productId,

        });

        return;

      }



      // ============================================
      // ADD PRODUCT TO ORDER
      // ============================================

      productsToBeAdded.push({

        productId:
          product.productId,

        name:
          product.name,

        price:
          product.price,

        quantity:
          quantity,

        image:
          product.images?.[0] || "",

      });



      // ============================================
      // CALCULATE TOTAL ON BACKEND
      // ============================================

      total +=
        quantity *
        product.price;

    }



    // =====================================================
    // CREATE ORDER
    // =====================================================

    // =====================================================
    // CREATE ORDER
    // =====================================================

    const newOrder = new Order({

      orderId: newOrderId,

      email: user.email,

      fullName: customerName,

      phone: customerPhone,

      address: req.body.address,

      city: req.body.city,

      district: req.body.district,

      notes: req.body.notes || "",

      products: productsToBeAdded,

      totalPrice: total,

      status: "Pending",

    });



    // =====================================================
    // SAVE ORDER
    // =====================================================

    const savedOrder =
      await newOrder.save();



    // =====================================================
    // RESPONSE
    // =====================================================

    res.status(201).json({

      message:
        "Order created successfully",

      order:
        savedOrder,

    });


  } catch (err) {

    console.error(
      "Create Order Error:",
      err
    );


    res.status(500).json({

      message:
        "Internal server error",

      error:
        err.message,

    });

  }

}

//------------------------------------------------------------------------------------------------------------------------------

export async function getOrders(req, res) {

  try {

    const user = req.user;


    // =========================================
    // CHECK LOGIN
    // =========================================

    if (user == null) {

      res.status(401).json({
        message: "Unauthorized",
      });

      return;

    }


    console.log("GET ORDERS USER:", user);


    // =========================================
    // ADMIN
    // =========================================

    if (
      user.role?.toLowerCase() === "admin"
    ) {

      const allOrders = await Order
        .find()
        .sort({ date: -1 });


      res.status(200).json(
        allOrders
      );

      return;

    }


    // =========================================
    // CUSTOMER
    // =========================================

    if (!user.email) {

      res.status(400).json({
        message: "User email not found",
      });

      return;

    }


    const orders = await Order
      .find({
        email: user.email,
      })
      .sort({ date: -1 });


    res.status(200).json(
      orders
    );


  } catch (err) {

    console.error(
      "Get Orders Error:",
      err
    );


    res.status(500).json({

      message:
        "Internal server error",

      error:
        err.message,

    });

  }

}

//--------------------------------------------------------------------------------------------------------------

export async function updateOrderStatus(req, res) {

  if (!isAdmin(req)) {

    res.status(403).json({
      message: "Forbidden",
    });

    return;
  }


  const orderId = req.params.orderId;

  const newStatus = req.body.status;


  const allowedStatuses = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];


  if (!allowedStatuses.includes(newStatus)) {

    res.status(400).json({
      message: "Invalid order status",
    });

    return;
  }


  try {

    const result = await Order.updateOne(
      {
        orderId: orderId,
      },
      {
        status: newStatus,
      },
      {
        runValidators: true,
      }
    );


    if (result.matchedCount === 0) {

      res.status(404).json({
        message: "Order not found",
      });

      return;
    }


    res.json({
      message: "Order updated successfully",
      orderId: orderId,
      status: newStatus,
    });


  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });

  }

} 
