import express from "express";
import { getShippingConfig, getShippingLocations } from "./shipping.controller.js";

const shippingRouter = express.Router();

// Public endpoints for locations + dynamic shipping charges
shippingRouter.get("/locations", getShippingLocations);
shippingRouter.get("/config", getShippingConfig);

export default shippingRouter;

