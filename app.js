// app.js

const express = require("express");
const multer = require("multer");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const ExifImage = require("exif").ExifImage;

const app = express();
const port = 3000;

// Firebase 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://itfimgsaveservice.appspot.com",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 루트 경로에 대한 요청 처리 (초기화면)
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// 이미지 업로드 및 정보 저장 엔드포인트
app.post("/upload", upload.array("images"), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      res.status(400).send("No files uploaded.");
      return;
    }

    for (let file of files) {
      // 이미지 파일에서 EXIF 데이터 추출
      const exifData = await getExifData(file.buffer);
      if (!exifData) {
        console.error("Error extracting exif data.");
        continue;
      }

      // 필요한 정보 추출
      const dateTime = exifData.DateTimeOriginal;
      const latitude = exifData.GPSLatitude || "N/A";
      const longitude = exifData.GPSLongitude || "N/A";
      const fileSize = file.size;
      const constructionSite = req.body.constructionSite;

      // 이미지 파일을 Firebase Storage에 업로드
      const timestamp = Date.now();
      const filename = `${timestamp}_${file.originalname}`;
      const fileUpload = bucket.file(`images/${filename}`);
      await fileUpload.save(file.buffer);

      // Firebase Firestore에 이미지 정보 저장
      await db.collection("images").add({
        filename: file.originalname,
        imageUrl: `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`,
        uploadTime: admin.firestore.FieldValue.serverTimestamp(),
        dateTime: dateTime,
        latitude: latitude,
        longitude: longitude,
        fileSize: fileSize,
        constructionSite: constructionSite,
      });
    }

    res.status(200).send("Images uploaded successfully.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

// EXIF 데이터 추출 함수
function getExifData(imageBuffer) {
  return new Promise((resolve, reject) => {
    new ExifImage({ image: imageBuffer }, (error, exifData) => {
      if (error) {
        reject(error);
      } else {
        resolve(exifData.exif);
      }
    });
  });
}

// 특정 조건에 해당하는 사진 다운로드 엔드포인트
app.get("/download", async (req, res) => {
  const constructionSite = req.query.constructionSite;
  const date = req.query.date;

  try {
    // 해당 조건에 맞는 사진을 Firestore에서 조회
    const snapshot = await db
      .collection("images")
      .where("dateTime", "==", date)
      .where("constructionSite", "==", constructionSite)
      .get();
    const images = [];
    snapshot.forEach((doc) => {
      images.push(doc.data());
    });

    // 압축할 파일들의 경로를 배열에 추가
    const filesToZip = images.map((image) => {
      return `images/${image.filename}`;
    });

    // 압축 파일 생성
    const zipFile = `${date}_${constructionSite}_images.zip`;
    const output = fs.createWriteStream(zipFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      // 압축이 완료되면 클라이언트에게 다운로드 링크 제공
      res.download(zipFile, (err) => {
        if (err) {
          console.error(err);
          res.status(500).send("Error downloading zip file.");
        }
        // 다운로드 후 zip 파일 삭제
        fs.unlinkSync(zipFile);
      });
    });

    archive.pipe(output);
    for (const file of filesToZip) {
      archive.file(file, { name: file });
    }
    archive.finalize();
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
