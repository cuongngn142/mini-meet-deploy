/**
 * Material Controller
 * Quản lý tài liệu học tập
 * Xử lý upload, xem và download file tài liệu
 */
const Material = require("../models/Material");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Class = require("../models/Class");

// Cấu hình Multer cho upload tài liệu (max 100MB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/materials";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

const uploadMaterial = upload.single("file");

/**
 * Tạo tài liệu mới
 * Upload file và lưu thông tin tài liệu, thêm vào lớp
 */
const createMaterial = async (req, res) => {
  try {
    const { title, description, classId } = req.body;

    if (!req.file) {
      return res.render("error", {
        error: "No file uploaded",
        user: req.user,
      });
    }

    const fileType = getFileType(req.file.mimetype);

    const material = await Material.create({
      title,
      description,
      class: classId,
      uploadedBy: req.user._id,
      fileType,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    await Class.findByIdAndUpdate(classId, {
      $push: { materials: material._id },
    });

    res.redirect(`/material/${material._id}`);
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const getMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id)
      .populate("class", "name code")
      .populate("uploadedBy", "name email");

    if (!material) {
      return res.render("error", {
        error: "Material not found",
        user: req.user,
      });
    }

    res.render("material/view", {
      material,
      user: req.user,
    });
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const listMaterials = async (req, res) => {
  try {
    const { classId } = req.query;
    const query = classId ? { class: classId } : {};

    const materials = await Material.find(query)
      .populate("class", "name")
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });

    res.render("material/list", {
      materials,
      user: req.user,
      classId,
    });
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const downloadMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).send("Material not found");
    }

    res.download(material.filePath, material.fileName);
  } catch (error) {
    res.status(500).send("Error downloading file");
  }
};

function getFileType(mimetype) {
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.includes("presentation") || mimetype.includes("powerpoint"))
    return "ppt";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.includes("document") || mimetype.includes("word"))
    return "document";
  return "other";
}

module.exports = {
  uploadMaterial,
  createMaterial,
  getMaterial,
  listMaterials,
  downloadMaterial,
};
