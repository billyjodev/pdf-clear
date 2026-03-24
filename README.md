<p align="center">
  <img src="og-image.png" alt="PDF-Clear" width="100%">
</p>

# PDF-Clear

A client-side web application for erasing/filling regions in PDF files. Users load a PDF, select rectangular regions via mouse drag, choose a fill color mode, and download the modified PDF or export as PPT. All processing happens in the browser — no backend server.

---

## Features

- **PDF Loading**: Load local PDF files and view them directly in the browser
- **Region Selection**: Select rectangular regions by left-click dragging
- **Bulk Delete**: Right-click drag to select an area, then left-click to delete all selections within
- **Color Fill Modes**:
  - **Dominant**: Fill with the most frequent color in the selected region
  - **Border**: Fill with the average color of the region's edges
  - **Custom**: Pick any color using the color picker
- **Group Selections**: Apply selections across multiple pages with scope management
- **Page-Level Batch Operations**: Apply/Revert/Delete all selections on current page
- **Group Tooltips**: Hover over group indicators to see target pages
- **Auto Text Detection**: Automatically detect text regions using OCR
- **Export**: Download modified PDF or export as PowerPoint (PPT)
- **Page Navigation**: First/Previous/Next/Last page buttons for easy navigation
- **Selection Management**: View and manage individual selections with revert capability

---

## How to Use

### Basic Workflow
1. **Select PDF**: Click the "Select PDF" button to upload a PDF file
2. **Choose Color Mode**: Select your preferred fill color mode (Dominant/Border/Custom)
3. **Select Regions**: Left-click drag on the PDF page to select regions you want to fill
4. **Apply**: Click "Apply" for current page or "Apply All" to apply selections (supports scope: Current/All/Range)
5. **Download**: Click "Download PDF" for modified PDF or "Download PPT" for PowerPoint export

### Advanced Features
- **Bulk Delete**: Right-click drag to select an area (blue box), then left-click to delete all selections in that area (group selections are preserved)
- **Group Management**: When applying to multiple pages, selections are grouped with visual indicators
- **Revert**: Click "Revert" on applied selections to return to pending state (preserves original scope/range)
- **Page Batch Operations**: Use per-page Apply/Revert/Delete buttons in the selection list header
- **Auto Detect** (optional): Click "Auto Detect Text" to automatically detect text regions using OCR

---

## Running Locally

No build step or package manager required. Simply open `index.html` directly in your browser.

---

## Web Version

You can also use the web version at: **https://billyjodev.github.io/pdf-clear**

---

## Licenses

This project uses the following open-source libraries:

### PDF.js
- **License**: Apache-2.0
- **Source**: https://github.com/mozilla/pdf.js
- **CDN**: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/

### pdf-lib
- **License**: MIT
- **Source**: https://github.com/Hopding/pdf-lib
- **CDN**: https://unpkg.com/pdf-lib@1.17.1/

### PptxGenJS
- **License**: MIT
- **Source**: https://github.com/gitbrent/pptxgenjs
- **CDN**: https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/

### Tesseract.js
- **License**: Apache-2.0
- **Source**: https://github.com/naptha/tesseract.js
- **CDN**: https://cdn.jsdelivr.net/npm/tesseract.js@5/

### Tailwind CSS
- **License**: MIT
- **Source**: https://tailwindcss.com/
- **CDN**: https://cdn.tailwindcss.com

---

## Privacy Notice

- All processing happens locally in your browser
- No data is sent to any server
- Your PDF files never leave your device

---

## Browser Compatibility

Works on modern browsers that support:
- Canvas API
- ES6+ JavaScript
- File API

Recommended: Chrome, Firefox, Edge, Safari (latest versions)

---

## Project Structure

```
pdf-clear/
├── index.html    # Main HTML file
├── app.js        # Application logic (single-class design)
└── README.md     # This file
```

---

## Notes

- Large PDF files may take some time to load
- OCR text detection requires Tesseract.js to be loaded (automatic on first use)
- All UI text is in Korean

---

## License

This project is open source and available under the MIT License.

---

# PDF 영역 지우기 도구

PDF 파일의 특정 영역을 선택하고 지정한 색상으로 채울 수 있는 웹 애플리케이션입니다. 모든 처리는 브라우저에서 이루어지며 별도의 서버가 필요 없습니다.

---

## 기능

- **PDF 파일 로드**: 로컬 PDF 파일을 불러와서 브라우저에서 바로 뷰어
- **좌측 클릭 드래그 선택**: 마우스 좌측 드래그로 박스 영역 선택
- **우측 클릭 일괄 삭제**: 우측 드래그로 영역 선택(파란 박스), 좌측 클릭으로 해당 영역 내 선택영역 일괄 삭제
- **색상 채우기 모드**:
  - **최빈**: 선택 영역에서 가장 많이 나타나는 색상으로 채우기
  - **테두리**: 선택 영역 테두리의 평균 색상으로 채우기
  - **지정**: 색상 선택기에서 원하는 색상 지정
- **그룹 선택영역**: 여러 페이지에 걸친 선택영역을 그룹으로 관리
- **페이지별 일괄 작업**: 현재 페이지의 선택영역 Apply/Revert/Delete 버튼
- **그룹 표시기 툴팁**: 그룹 표시에 호버하면 대상 페이지 표시
- **텍스트 자동 감지**: OCR을 사용하여 텍스트 영역 자동 감지
- **내보내기**: 수정된 PDF 다운로드 또는 PPT로 내보내기
- **페이지 네비게이션**: 처음/이전/다음/마지막 페이지 버튼으로 쉬운 navigation
- **선택 영역 관리**: 개별 선택 영역 확인 및 되돌리기 기능

---

## 사용법

### 기본 워크플로우
1. **PDF 파일 선택**: 'Select PDF' 버튼을 클릭하여 PDF 파일을 업로드
2. **색상 모드 선택**: 원하는 채우기 색상 모드 선택 (Dominant/Border/Custom)
3. **영역 선택**: PDF 페이지에서 **좌측 마우스 드래그**로 지울 영역을 선택
4. **적용**: 'Apply' 버튼으로 현재 페이지에 적용하거나, 'Apply All'로 다른 페이지에도 적용 (범위 설정: 현재/모두/지정 페이지)
5. **다운로드**: 'Download PDF' 클릭하여 수정된 PDF 다운로드 또는 'Download PPT'로 PPT 내보내기

### 고급 기능
- **일괄 삭제**: **우측 마우스 드래그**로 영역 선택(파란 박스)한 후 **좌측 클릭**하면 해당 영역 내 모든 선택영역 삭제 (그룹 선택영역은 유지)
- **그룹 관리**: 여러 페이지에 적용한 선택영역은 자동으로 그룹화되며 시각적 표시가 됨
- **되돌리기**: 적용된 선택영역의 'Revert' 버튼을 클릭하면 원래 옵션(범위, 색상 모드)을 유지한 채 대기 상태로 복원
- **페이지별 일괄 작업**: 선택영역 목록 헤더의 Apply/Revert/Delete 버튼으로 현재 페이지의 모든 선택영역 일괄 처리
- **텍스트 자동 감지** (선택 사항): 'Auto Detect Text' 버튼을 클릭하여 텍스트 영역 자동 감지

---

## 로컬 실행

빌드 과정이나 패키지 관리자가 필요 없습니다. `index.html` 파일을 브라우저에서 직접 열면 됩니다.

---

## 웹 버전

웹 버전도 이용 가능합니다: **https://billyjodev.github.io/pdf-clear**

---

## 라이선스

이 프로젝트는 다음 오픈 소스 라이브러리를 사용합니다:

### PDF.js
- **라이선스**: Apache-2.0
- **소스**: https://github.com/mozilla/pdf.js
- **CDN**: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/

### pdf-lib
- **라이선스**: MIT
- **소스**: https://github.com/Hopding/pdf-lib
- **CDN**: https://unpkg.com/pdf-lib@1.17.1/

### PptxGenJS
- **라이선스**: MIT
- **소스**: https://github.com/gitbrent/pptxgenjs
- **CDN**: https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/

### Tesseract.js
- **라이선스**: Apache-2.0
- **소스**: https://github.com/naptha/tesseract.js
- **CDN**: https://cdn.jsdelivr.net/npm/tesseract.js@5/

### Tailwind CSS
- **라이선스**: MIT
- **소스**: https://tailwindcss.com/
- **CDN**: https://cdn.tailwindcss.com

---

## 개인정보 안내

- 모든 처리는 브라우저에서 로컬로 수행됩니다
- 서버로 데이터가 전송되지 않습니다
- PDF 파일이 기기 밖으로 나가지 않습니다

---

## 브라우저 호환성

다음을 지원하는 최신 브라우저에서 작동:
- Canvas API
- ES6+ JavaScript
- File API

권장: Chrome, Firefox, Edge, Safari (최신 버전)

---

## 프로젝트 구조

```
pdf-clear/
├── index.html    # 메인 HTML 파일
├── app.js        # 애플리케이션 로직 (단일 클래스 설계)
└── README.md     # 이 파일
```

---

## 참고사항

- 큰 PDF 파일의 경우 로딩 시간이 다소 걸릴 수 있습니다
- OCR 텍스트 감지는 Tesseract.js 로딩이 필요합니다 (처음 사용 시 자동 로딩)
- 모든 UI 텍스트는 영어로 제공됩니다

---

## 라이선스

이 프로젝트는 MIT 라이선스 하에 오픈 소스로 제공됩니다.
