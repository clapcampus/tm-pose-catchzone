/**
 * gameEngine.js
 * Catch Zone 게임 로직 전체를 담당
 *
 * - 3개 구역(LEFT, CENTER, RIGHT) 시스템
 * - 아이템 생성 및 낙하 (폭탄, 사과, 배, 오렌지)
 * - 충돌 감지 및 점수 계산
 * - 놓침 카운트 (2번 미스 → 게임 오버)
 * - 단계 시스템 (20초마다 레벨업, 낙하속도 증가)
 */

class GameEngine {
  constructor() {
    // 게임 상태
    this.isGameActive = false;
    this.score = 0;
    this.level = 1;
    this.missCount = 0;
    this.maxMisses = 2;

    // 바구니 위치 (LEFT, CENTER, RIGHT)
    this.basketPosition = "CENTER";
    this.zones = ["LEFT", "CENTER", "RIGHT"];

    // 아이템 설정
    this.items = [];
    this.itemTypes = [
      { type: "bomb", icon: "💣", points: 0, isBomb: true },
      { type: "apple", icon: "🍎", points: 100, isBomb: false },
      { type: "pear", icon: "🍐", points: 150, isBomb: false },
      { type: "orange", icon: "🍊", points: 200, isBomb: false }
    ];

    // 단계 시스템
    this.levelTimer = null;
    this.levelTimeLimit = 20; // 각 단계당 20초
    this.levelTimeRemaining = this.levelTimeLimit;

    // 아이템 생성 타이머
    this.itemSpawnTimer = null;

    // 콜백
    this.onScoreChange = null;
    this.onMissChange = null;
    this.onLevelChange = null;
    this.onGameEnd = null;
    this.onBasketMove = null;
  }

  /**
   * 게임 시작
   */
  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.missCount = 0;
    this.basketPosition = "CENTER";
    this.items = [];
    this.levelTimeRemaining = this.levelTimeLimit;

    // UI 초기화
    this.updateUI();

    // 단계 타이머 시작
    this.startLevelTimer();

    // 아이템 생성 시작
    this.startItemSpawner();

    // 아이템 업데이트 루프 시작
    this.startItemUpdater();
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    this.clearTimers();

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 단계 타이머 시작
   */
  startLevelTimer() {
    this.levelTimer = setInterval(() => {
      this.levelTimeRemaining--;

      // 시간 UI 업데이트
      this.updateTimeUI();

      // 단계 시간 종료 → 다음 단계로
      if (this.levelTimeRemaining <= 0) {
        this.nextLevel();
      }
    }, 1000);
  }

  /**
   * 다음 단계로 진행
   */
  nextLevel() {
    this.level++;
    this.levelTimeRemaining = this.levelTimeLimit;

    if (this.onLevelChange) {
      this.onLevelChange(this.level);
    }

    // 아이템 생성 속도 증가
    this.restartItemSpawner();
  }

  /**
   * 아이템 생성기 시작
   */
  startItemSpawner() {
    const spawnInterval = this.getItemSpawnInterval();

    this.itemSpawnTimer = setInterval(() => {
      if (this.isGameActive) {
        this.spawnItem();
      }
    }, spawnInterval);
  }

  /**
   * 아이템 생성기 재시작 (레벨업 시)
   */
  restartItemSpawner() {
    clearInterval(this.itemSpawnTimer);
    this.startItemSpawner();
  }

  /**
   * 아이템 생성 간격 계산
   * 단계별 낙하 시간의 60%~80% 사이 랜덤 값
   */
  getItemSpawnInterval() {
    const dropTime = this.getDropTime();
    const minInterval = dropTime * 0.6;
    const maxInterval = dropTime * 0.8;
    return (minInterval + Math.random() * (maxInterval - minInterval)) * 1000;
  }

  /**
   * 아이템 낙하 시간 계산 (초 단위)
   * 1단계: 2.0초, 2단계: 1.8초, ... (0.2초씩 감소, 최소 0.6초)
   */
  getDropTime() {
    const baseDropTime = 2.0;
    const decreasePerLevel = 0.2;
    const minDropTime = 0.6;
    return Math.max(baseDropTime - (this.level - 1) * decreasePerLevel, minDropTime);
  }

  /**
   * 아이템 생성
   */
  spawnItem() {
    // 랜덤 구역 선택
    const zone = this.zones[Math.floor(Math.random() * this.zones.length)];

    // 랜덤 아이템 타입 선택 (폭탄 20% 확률)
    const isBomb = Math.random() < 0.2;
    let itemType;

    if (isBomb) {
      itemType = this.itemTypes[0]; // 폭탄
    } else {
      // 과일 중 랜덤 선택
      const fruitTypes = this.itemTypes.slice(1);
      itemType = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
    }

    const item = {
      id: Date.now() + Math.random(),
      zone: zone,
      type: itemType.type,
      icon: itemType.icon,
      points: itemType.points,
      isBomb: itemType.isBomb,
      progress: 0, // 0 ~ 1 (낙하 진행도)
      dropTime: this.getDropTime()
    };

    this.items.push(item);
  }

  /**
   * 아이템 업데이트 루프
   */
  startItemUpdater() {
    const updateInterval = 1000 / 60; // 60 FPS

    this.itemUpdateTimer = setInterval(() => {
      if (!this.isGameActive) return;

      const deltaTime = updateInterval / 1000; // 초 단위

      this.items.forEach((item, index) => {
        // 낙하 진행도 업데이트
        item.progress += deltaTime / item.dropTime;

        // 아이템이 바닥에 도달했을 때
        if (item.progress >= 1.0) {
          this.handleItemReachedBottom(item);
          this.items.splice(index, 1);
        }
      });

      // 아이템 UI 렌더링
      this.renderItems();
    }, updateInterval);
  }

  /**
   * 아이템이 바닥에 도달했을 때 처리
   */
  handleItemReachedBottom(item) {
    // 바구니와 같은 구역인지 확인
    if (item.zone === this.basketPosition) {
      // 아이템 획득
      this.catchItem(item);
    } else {
      // 아이템 놓침 (폭탄은 놓침으로 카운트 안 함)
      if (!item.isBomb) {
        this.missItem();
      }
    }
  }

  /**
   * 아이템 획득
   */
  catchItem(item) {
    if (item.isBomb) {
      // 폭탄 획득 → 즉시 게임 오버
      this.gameOver("폭탄을 받았습니다!");
    } else {
      // 과일 획득 → 점수 증가
      this.score += item.points;
      if (this.onScoreChange) {
        this.onScoreChange(this.score);
      }
      this.showFeedback(`+${item.points}점!`, item.zone, "success");
    }
  }

  /**
   * 아이템 놓침
   */
  missItem() {
    this.missCount++;

    if (this.onMissChange) {
      this.onMissChange(this.missCount);
    }

    if (this.missCount === 1) {
      this.showFeedback("경고!", null, "warning");
    } else if (this.missCount >= this.maxMisses) {
      this.gameOver(`과일을 ${this.maxMisses}번 놓쳤습니다!`);
    }
  }

  /**
   * 게임 오버
   */
  gameOver(reason) {
    this.stop();
    alert(`게임 오버!\n${reason}\n\n최종 점수: ${this.score}\n도달 레벨: ${this.level}`);
  }

  /**
   * 피드백 표시
   */
  showFeedback(message, zone, type) {
    const feedbackEl = document.getElementById("feedback");
    if (feedbackEl) {
      feedbackEl.textContent = message;
      feedbackEl.className = `feedback ${type}`;
      feedbackEl.style.display = "block";

      setTimeout(() => {
        feedbackEl.style.display = "none";
      }, 1000);
    }
  }

  /**
   * 바구니 이동
   * @param {string} pose - "왼쪽", "정면", "오른쪽"
   */
  moveBasket(pose) {
    if (!this.isGameActive) return;

    // 포즈 → 구역 매핑
    const poseToZone = {
      "왼쪽": "LEFT",
      "정면": "CENTER",
      "오른쪽": "RIGHT"
    };

    const newPosition = poseToZone[pose];
    if (newPosition && newPosition !== this.basketPosition) {
      this.basketPosition = newPosition;

      if (this.onBasketMove) {
        this.onBasketMove(this.basketPosition);
      }

      // 바구니 위치 UI 업데이트
      this.updateBasketUI();
    }
  }

  /**
   * UI 업데이트
   */
  updateUI() {
    // 점수 업데이트
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = this.score;

    // 레벨 업데이트
    const levelEl = document.getElementById("level");
    if (levelEl) levelEl.textContent = this.level;

    // 미스 횟수 업데이트
    const missEl = document.getElementById("miss-count");
    if (missEl) missEl.textContent = `${this.missCount} / ${this.maxMisses}`;

    // 시간 업데이트
    this.updateTimeUI();

    // 바구니 위치 업데이트
    this.updateBasketUI();
  }

  /**
   * 시간 UI 업데이트
   */
  updateTimeUI() {
    const timeEl = document.getElementById("time-remaining");
    if (timeEl) timeEl.textContent = this.levelTimeRemaining;
  }

  /**
   * 바구니 UI 업데이트
   */
  updateBasketUI() {
    // 모든 바구니에서 active 클래스 제거
    document.querySelectorAll(".basket").forEach(basket => {
      basket.classList.remove("active");
    });

    // 현재 위치의 바구니에 active 클래스 추가
    const currentBasket = document.querySelector(`.basket[data-zone="${this.basketPosition}"]`);
    if (currentBasket) {
      currentBasket.classList.add("active");
    }
  }

  /**
   * 아이템 렌더링
   */
  renderItems() {
    const gameArea = document.getElementById("game-area");
    if (!gameArea) return;

    // 기존 아이템 DOM 제거
    const existingItems = gameArea.querySelectorAll(".item");
    existingItems.forEach(el => el.remove());

    // 아이템 렌더링
    this.items.forEach(item => {
      const itemEl = document.createElement("div");
      itemEl.className = `item item-${item.type}`;
      itemEl.textContent = item.icon;
      itemEl.setAttribute("data-zone", item.zone);

      // 위치 계산 (progress: 0 ~ 1)
      const topPercent = item.progress * 100;
      itemEl.style.top = `${topPercent}%`;

      gameArea.appendChild(itemEl);
    });
  }

  /**
   * 타이머 정리
   */
  clearTimers() {
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }

    if (this.itemSpawnTimer) {
      clearInterval(this.itemSpawnTimer);
      this.itemSpawnTimer = null;
    }

    if (this.itemUpdateTimer) {
      clearInterval(this.itemUpdateTimer);
      this.itemUpdateTimer = null;
    }
  }

  /**
   * 콜백 등록
   */
  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  setMissChangeCallback(callback) {
    this.onMissChange = callback;
  }

  setLevelChangeCallback(callback) {
    this.onLevelChange = callback;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }

  setBasketMoveCallback(callback) {
    this.onBasketMove = callback;
  }

  /**
   * 현재 게임 상태 반환
   */
  getGameState() {
    return {
      isActive: this.isGameActive,
      score: this.score,
      level: this.level,
      missCount: this.missCount,
      basketPosition: this.basketPosition,
      itemCount: this.items.length
    };
  }
}

// 전역으로 내보내기
window.GameEngine = GameEngine;
