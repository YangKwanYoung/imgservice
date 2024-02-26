// script.js

async function uploadImages() {
  alert("이미지를 선택해주세요.");

  const constructionSite = document.getElementById("constructionSite").value;
  const imageInput = document.getElementById("imageInput");
  const files = imageInput.files;

  if (!files || files.length === 0) {
    alert("이미지를 선택해주세요.");
    return;
  }

  const formData = new FormData();
  formData.append("constructionSite", constructionSite);

  for (let i = 0; i < files.length; i++) {
    formData.append("images", files[i]);
  }

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("이미지 업로드 중 오류가 발생했습니다.");
    }

    alert("이미지가 성공적으로 업로드되었습니다.");
  } catch (error) {
    console.error(error);
    alert("이미지 업로드 중 오류가 발생했습니다.");
  }
}
// script.js

function downloadImages() {
  const constructionSite = document.getElementById("constructionSite").value;
  const date = document.getElementById("datePicker").value;

  // 검색 조건을 서버로 전달하여 다운로드 링크 받아오기
  window.location.href = `/download?constructionSite=${constructionSite}&date=${date}`;
}
