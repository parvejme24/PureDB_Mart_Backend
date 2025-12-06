import Setting from "./settings.model.js";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

const ensureSettings = async () => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({});
  }
  return settings;
};

export const getSettings = async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.status(200).json({ settings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const settings = await ensureSettings();
    const {
      siteTitle,
      siteDescription,
      shippingInsideDhaka,
      shippingOutsideDhaka,
      freeDeliveryEnabled,
      freeDeliveryNote,
    } = req.body;

    if (siteTitle !== undefined) settings.siteTitle = siteTitle;
    if (siteDescription !== undefined) settings.siteDescription = siteDescription;

    if (shippingInsideDhaka !== undefined) {
      const inside = Math.max(0, Number(shippingInsideDhaka) || 0);
      settings.shippingInsideDhaka = inside;
    }
    if (shippingOutsideDhaka !== undefined) {
      const outside = Math.max(0, Number(shippingOutsideDhaka) || 0);
      settings.shippingOutsideDhaka = outside;
    }

    if (freeDeliveryEnabled !== undefined) {
      const boolValue =
        freeDeliveryEnabled === true ||
        freeDeliveryEnabled === "true" ||
        freeDeliveryEnabled === "1" ||
        freeDeliveryEnabled === "yes" ||
        freeDeliveryEnabled === "on";
      settings.freeDeliveryEnabled = boolValue;
    }

    if (freeDeliveryNote !== undefined) {
      settings.freeDeliveryNote = freeDeliveryNote;
    }

    const handleImageUpdate = async (fieldName, files) => {
      if (!files?.length) return;
      const file = files[0];

      if (settings[fieldName]?.public_id) {
        await deleteImage(settings[fieldName].public_id);
      }

      const uploadResult = await uploadFromBuffer(file.buffer, "settings");
      settings[fieldName] = {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      };
    };

    await handleImageUpdate("siteLogo", req.files?.siteLogo);
    await handleImageUpdate("siteFavicon", req.files?.siteFavicon);

    await settings.save();
    res.status(200).json({ message: "Settings updated", settings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

