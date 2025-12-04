/**
 * main.js
 * Catch Zone 게임의 진입점
 *
 * PoseEngine, GameEngine, Stabilizer를 조합하여 애플리케이션 구동
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.7,
      smoothingFrames: 3
    });

    // 3. GameEngine 초기화
    gameEngine = new GameEngine();

    // 4. 캔버스 설정
    const canvas = document.getElementById("canvas");
    canvas.width = 200;
    canvas.height = 200;
    ctx = canvas.getContext("2d");

    // 5. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 6. GameEngine 콜백 설정
    setupGameCallbacks();

    // 7. PoseEngine 시작
    poseEngine.start();

    // 8. 게임 자동 시작
    gameEngine.start();

    stopBtn.disabled = false;
  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine && gameEngine.isGameActive) {
    gameEngine.stop();
  }

  if (stabilizer) {
    stabilizer.reset();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * 게임 엔진 콜백 설정
 */
function setupGameCallbacks() {
  // 점수 변경 콜백
  gameEngine.setScoreChangeCallback((score) => {
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = score;
  });

  // 미스 변경 콜백
  gameEngine.setMissChangeCallback((missCount) => {
    const missEl = document.getElementById("miss-count");
    if (missEl) missEl.textContent = `${missCount} / ${gameEngine.maxMisses}`;
  });

  // 레벨 변경 콜백
  gameEngine.setLevelChangeCallback((level) => {
    const levelEl = document.getElementById("level");
    if (levelEl) levelEl.textContent = level;

    // 레벨업 오버레이가 표시되므로 추가 알림 불필요
  });

  // 게임 종료 콜백
  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    // 게임 종료는 이미 gameEngine에서 alert로 표시
  });

  // 바구니 이동 콜백
  gameEngine.setBasketMoveCallback((position) => {
    // 바구니 이동은 gameEngine에서 UI 업데이트 처리
  });
}

/**
 * 예측 결과 처리 콜백
 * @param {Array} predictions - TM 모델의 예측 결과
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  if (maxPredictionDiv) {
    maxPredictionDiv.innerHTML = stabilized.className || "감지 중...";
  }

  // 3. GameEngine에 포즈 전달 (게임 모드일 경우)
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.moveBasket(stabilized.className);
  }
}

/**
 * 포즈 그리기 콜백
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    // 키포인트와 스켈레톤 그리기
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }
}

/**
 * 알림 표시
 */
function showNotification(message, type) {
  const notificationEl = document.getElementById("notification");
  if (notificationEl) {
    notificationEl.textContent = message;
    notificationEl.className = `notification ${type}`;
    notificationEl.style.display = "block";

    setTimeout(() => {
      notificationEl.style.display = "none";
    }, 2000);
  }
}
