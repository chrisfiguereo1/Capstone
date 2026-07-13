require("dotenv").config();

const mongoose = require("mongoose");
const Fragrance = require("../models/fragrance");

async function addImage() {
  try {
    await mongoose.connect(process.env.MONGO_URL);

    const fragrance = await Fragrance.findOneAndUpdate(
      {
        name: { $regex: "^Aventus$", $options: "i" },
        brand: { $regex: "^Creed$", $options: "i" },
      },
      {
        $set: {
          imageUrl:
            "https://res.cloudinary.com/jst8wm0w/image/upload/v1783903296/waterscent/fragrances/creed-aventus-test.webp",

          imagePublicId:
            "waterscent/fragrances/creed-aventus-test",

          imageSource: "Cloudinary Test",
        },
      },
      {
        new: true,
      }
    );

    if (!fragrance) {
      console.log(" Aventus not found.");
      return;
    }

    console.log(" Image added!");
    console.log(fragrance.name);
    console.log(fragrance.imageUrl);

  } catch (err) {
    console.log(err);
  } finally {
    await mongoose.disconnect();
  }
}

addImage();

