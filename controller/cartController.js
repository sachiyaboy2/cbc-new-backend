import Cart from "../models/cart.js";
import Product from "../models/product.js";

// =====================================================
// HELPER - GET CART WITH LATEST PRODUCT DETAILS
// =====================================================

async function getCartItemsWithProductDetails(cart) {
  if (cart == null || cart.items.length === 0) {
    return [];
  }

  const productIds = cart.items.map((item) => item.productId);

  const products = await Product.find({
    productId: {
      $in: productIds,
    },
  });

  const productMap = new Map();

  for (const product of products) {
    productMap.set(product.productId, product);
  }

  const items = [];

  for (const cartItem of cart.items) {
    const product = productMap.get(cartItem.productId);

    // Product එක delete වෙලා තිබුණොත් cart response එකට දාන්නේ නැහැ.
    if (product == null) {
      continue;
    }

    items.push({
      productId: product.productId,
      name: product.name,
      price: product.price,
      labelNo: product.labelNo,
      quantity: cartItem.quantity,
      image: product.images?.[0] || "",
    });
  }

  return items;
}

// =====================================================
// GET LOGGED USER CART
// =====================================================

export async function getCart(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const email = req.user.email?.trim().toLowerCase();

    if (!email) {
      res.status(400).json({
        message: "User email not found",
      });
      return;
    }

    const cart = await Cart.findOne({
      email: email,
    });

    const items = await getCartItemsWithProductDetails(cart);

    res.status(200).json({
      items: items,
    });
  } catch (err) {
    console.error("Get Cart Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// =====================================================
// ADD / INCREASE / DECREASE CART ITEM
// quantity = 1  -> increase by 1
// quantity = -1 -> decrease by 1
// =====================================================

export async function addToCart(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const email = req.user.email?.trim().toLowerCase();
    const productId = req.body.productId?.trim();
    const quantityChange = Number(req.body.quantity);

    if (!email) {
      res.status(400).json({
        message: "User email not found",
      });
      return;
    }

    if (!productId) {
      res.status(400).json({
        message: "Product ID is required",
      });
      return;
    }

    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      res.status(400).json({
        message: "Quantity must be a non-zero whole number",
      });
      return;
    }

    const product = await Product.findOne({
      productId: productId,
    });

    if (product == null) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    const cart = await Cart.findOneAndUpdate(
      {
        email: email,
      },
      {
        $setOnInsert: {
          email: email,
          items: [],
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    const existingItem = cart.items.find((item) => {
      return item.productId === productId;
    });

    const currentQuantity = existingItem?.quantity || 0;
    const newQuantity = currentQuantity + quantityChange;

    // Quantity 0 හෝ අඩු වුණොත් item එක remove කරනවා.
    if (newQuantity <= 0) {
      cart.items = cart.items.filter((item) => {
        return item.productId !== productId;
      });
    } else {
      // labelNo = current stock quantity in the product model.
      if (newQuantity > product.labelNo) {
        res.status(400).json({
          code: "STOCK",
          message: `Only ${product.labelNo} item(s) available in stock`,
          productId: productId,
          availableStock: product.labelNo,
        });
        return;
      }

      if (existingItem) {
        existingItem.quantity = newQuantity;
      } else {
        cart.items.push({
          productId: productId,
          quantity: newQuantity,
        });
      }
    }

    await cart.save();

    const items = await getCartItemsWithProductDetails(cart);

    res.status(200).json({
      message: "Cart updated successfully",
      items: items,
    });
  } catch (err) {
    console.error("Add To Cart Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// =====================================================
// REMOVE ONE PRODUCT FROM CART
// =====================================================

export async function removeFromCart(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const email = req.user.email?.trim().toLowerCase();
    const productId = req.params.productId?.trim();

    if (!email) {
      res.status(400).json({
        message: "User email not found",
      });
      return;
    }

    if (!productId) {
      res.status(400).json({
        message: "Product ID is required",
      });
      return;
    }

    const cart = await Cart.findOne({
      email: email,
    });

    if (cart == null) {
      res.status(200).json({
        message: "Cart is already empty",
        items: [],
      });
      return;
    }

    cart.items = cart.items.filter((item) => {
      return item.productId !== productId;
    });

    await cart.save();

    const items = await getCartItemsWithProductDetails(cart);

    res.status(200).json({
      message: "Product removed from cart",
      items: items,
    });
  } catch (err) {
    console.error("Remove Cart Item Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// =====================================================
// CLEAR LOGGED USER CART
// =====================================================

export async function clearCart(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const email = req.user.email?.trim().toLowerCase();

    if (!email) {
      res.status(400).json({
        message: "User email not found",
      });
      return;
    }

    await Cart.findOneAndUpdate(
      {
        email: email,
      },
      {
        items: [],
      },
    );

    res.status(200).json({
      message: "Cart cleared successfully",
      items: [],
    });
  } catch (err) {
    console.error("Clear Cart Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}
