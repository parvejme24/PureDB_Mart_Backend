import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: null },
    public_id: { type: String, default: null },
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema(
  {
    siteTitle: { type: String, default: "PureBD Mart" },
    siteDescription: { type: String, default: "" },
    siteLogo: { type: ImageSchema, default: null },
    siteFavicon: { type: ImageSchema, default: null },
    shippingInsideDhaka: { type: Number, default: 70 },
    shippingOutsideDhaka: { type: Number, default: 110 },
    freeDeliveryEnabled: { type: Boolean, default: false },
    freeDeliveryNote: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Setting", SettingsSchema);

