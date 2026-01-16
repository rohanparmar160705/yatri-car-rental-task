const { query } = require("../config/db");

// Upload File Metadata
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { filename, originalname, mimetype, size, path } = req.file;
    const uploader_id = req.user.id;

    const result = await query(
      `INSERT INTO files (filename, original_name, mime_type, file_size, file_path, uploader_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [filename, originalname, mimetype, size, path, uploader_id]
    );

    const file = result.rows[0];
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;

    res.status(201).json({
      success: true,
      data: { id: file.id, url: fileUrl, metadata: file },
    });
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
};
