import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { Storage } from '@google-cloud/storage'
import cors from 'cors'
import { v4 as uuid } from 'uuid'

const app = express()

// 啟用 CORS 以允許跨域請求
// 這允許前端應用能夠訪問這個 API 服務
app.use(cors())

// 設置 multer 中間件用於處理文件上傳
// 使用內存存儲而不是磁盤存儲以提高性能
const upload = multer({ storage: multer.memoryStorage() })
// 初始化 Google Cloud Storage 客戶端
const storage = new Storage()

// 添加健康檢查端點
// 用於監控服務是否正常運行
app.get('/', (req, res) => {
  res.send('Image processor is running')
})

// 圖片壓縮和上傳端點
// 接受 multipart/form-data 格式的請求，包含圖片文件
app.post('/compress', upload.single('image'), async (req, res) => {
  try {
    // 驗證是否收到圖片文件
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    // 使用 sharp 庫處理圖片
    // 1. 調整圖片大小到最大寬度 800px
    // 2. 保持圖片比例
    // 3. 不放大小圖片
    // 4. 轉換為 JPEG 格式並壓縮到 80% 質量
    const compressedBuffer = await sharp(req.file.buffer)
      .resize(800, null, {
        withoutEnlargement: true, // 避免放大小圖片
        fit: 'inside', // 保持圖片比例
      })
      .jpeg({ quality: 80 }) // 轉換為 JPEG 並設置壓縮質量
      .toBuffer()

    // 準備上傳到 Google Cloud Storage
    const bucket = storage.bucket(
      process.env.GOOGLE_CLOUD_BUCKET_NAME as string
    )
    // 生成唯一的文件名，包含用戶 ID 和 UUID
    const fileName = `files/${req.body.userId}/imgs/${uuid()}.${req.body.fileName}`
    const file = bucket.file(fileName)

    // 將壓縮後的圖片保存到 GCS
    await file.save(compressedBuffer)

    // 生成公開訪問 URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`

    // 返回成功響應
    res.json({
      success: true,
      url: publicUrl,
    })
  } catch (error) {
    // 錯誤處理
    console.error('Image processing error:', error)
    res.status(500).json({ error: 'Failed to process image' })
  }
})

// 設置服務器監聽端口
// 默認使用 8080 端口，可通過環境變量覆蓋
const port = Number(process.env.PORT) || 8080

// 啟動服務器
// 監聽所有網絡接口 (0.0.0.0)
app.listen(port, '0.0.0.0', () => {
  console.log(`Image processor listening at http://0.0.0.0 ${port}`)
})

// 添加全局未捕獲異常處理器
// 防止程序因未處理的異常而崩潰
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// 添加未處理的 Promise 拒絕處理器
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})
