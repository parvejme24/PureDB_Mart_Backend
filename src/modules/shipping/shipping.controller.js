import { divisions, districts, upazilas } from "./shipping.data.js";
import Setting from "../settings/settings.model.js";

const ensureSettings = async () => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({});
  }
  return settings;
};

export const getShippingLocations = async (_req, res) => {
  try {
    res.status(200).json({ divisions, districts, upazilas });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getShippingConfig = async (_req, res) => {
  try {
    const settings = await ensureSettings();
    res.status(200).json({
      shippingInsideDhaka: settings.shippingInsideDhaka,
      shippingOutsideDhaka: settings.shippingOutsideDhaka,
      freeDeliveryEnabled: settings.freeDeliveryEnabled,
      freeDeliveryNote: settings.freeDeliveryNote,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

