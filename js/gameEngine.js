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

    // 레벨업 대기 상태
    this.isLevelUpPause = false;
    this.levelUpCountdown = 3;
    this.levelUpCountdownTimer = null;

    // 레벨 종료 상태 (아이템 처리 대기)
    this.isLevelEnding = false;

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

      // 단계 시간 종료 → 레벨 종료 시작 (아이템 처리 대기)
      if (this.levelTimeRemaining <= 0) {
        this.startLevelEnding();
      }
    }, 1000);
  }

  /**
   * 레벨 종료 시작 (아이템 처리 대기)
   */
  startLevelEnding() {
    this.isLevelEnding = true;

    // 타이머 중단
    clearInterval(this.levelTimer);

    // 새로운 아이템 생성 중단
    clearInterval(this.itemSpawnTimer);

    // 화면에 아이템이 없으면 즉시 레벨업
    if (this.items.length === 0) {
      this.nextLevel();
    }
    // 아이템이 있으면 모두 처리될 때까지 대기
    // (itemUpdateTimer에서 마지막 아이템 처리 시 nextLevel 호출)
  }

  /**
   * 다음 단계로 진행
   */
  nextLevel() {
    this.level++;
    this.levelTimeRemaining = this.levelTimeLimit;
    this.isLevelEnding = false; // 플래그 리셋

    // 레벨업 대기 시작
    this.pauseForLevelUp();
  }

  /**
   * 레벨업 대기 (게임 일시 정지)
   */
  pauseForLevelUp() {
    this.isLevelUpPause = true;
    this.levelUpCountdown = 3;

    // 타이머 일시 중단
    clearInterval(this.levelTimer);

    // 아이템 생성 중단
    clearInterval(this.itemSpawnTimer);

    // 축하 화면 표시
    this.showLevelUpOverlay();

    // 카운트다운 시작
    this.startLevelUpCountdown();
  }

  /**
   * 레벨업 카운트다운
   */
  startLevelUpCountdown() {
    this.levelUpCountdownTimer = setInterval(() => {
      this.levelUpCountdown--;
      this.updateLevelUpCountdown();

      if (this.levelUpCountdown <= 0) {
        clearInterval(this.levelUpCountdownTimer);
        this.resumeAfterLevelUp();
      }
    }, 1000);
  }

  /**
   * 레벨업 후 재개
   */
  resumeAfterLevelUp() {
    this.isLevelUpPause = false;

    // 축하 화면 숨기기
    this.hideLevelUpOverlay();

    // 타이머 재시작
    this.startLevelTimer();

    // 아이템 생성 재시작 (속도 증가 적용)
    this.restartItemSpawner();

    // 레벨 변경 콜백
    if (this.onLevelChange) {
      this.onLevelChange(this.level);
    }
  }

  /**
   * 레벨업 오버레이 표시
   */
  showLevelUpOverlay() {
    const overlay = document.getElementById("levelup-overlay");
    if (overlay) {
      const levelNumber = document.getElementById("levelup-number");
      const levelScore = document.getElementById("levelup-score");
      const levelTimer = document.getElementById("levelup-timer");

      if (levelNumber) levelNumber.textContent = this.level;
      if (levelScore) levelScore.textContent = this.score;
      if (levelTimer) levelTimer.textContent = this.levelUpCountdown;

      overlay.style.display = "flex";
    }
  }

  /**
   * 레벨업 오버레이 숨기기
   */
  hideLevelUpOverlay() {
    const overlay = document.getElementById("levelup-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  /**
   * 레벨업 카운트다운 업데이트
   */
  updateLevelUpCountdown() {
    const levelTimer = document.getElementById("levelup-timer");
    if (levelTimer) {
      levelTimer.textContent = this.levelUpCountdown;
    }
  }

  /**
   * 아이템 생성기 시작
   */
  startItemSpawner() {
    const spawnInterval = this.getItemSpawnInterval();

    this.itemSpawnTimer = setInterval(() => {
      if (this.isGameActive && !this.isLevelEnding) {
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
      dropTime: this.getDropTime(),
      caught: false // 포착 상태 (처음에는 false)
    };

    this.items.push(item);
  }

  /**
   * 아이템 업데이트 루프
   */
  startItemUpdater() {
    const updateInterval = 1000 / 60; // 60 FPS

    this.itemUpdateTimer = setInterval(() => {
      if (!this.isGameActive || this.isLevelUpPause) return; // 레벨업 대기 시 정지

      const deltaTime = updateInterval / 1000; // 초 단위

      this.items.forEach((item) => {
        // caught 상태가 아닌 경우만 낙하 진행도 업데이트
        if (!item.caught) {
          item.progress += deltaTime / item.dropTime;

          // 아이템이 바구니 위치(약 85%)에 도달했을 때 (progress >= 0.85)
          // 바구니는 화면 아래 10px 정도에 위치하므로 progress 85% 이상에서 만남
          if (item.progress >= 0.85) {
            item.caught = true; // 아이템을 caught 상태로 표시
            item.progress = 0.85; // 바구니 위치에 고정
            this.handleItemReachedBasket(item);

            // 애니메이션 완료 후 아이템 제거 (300ms = itemCaught 애니메이션 시간)
            setTimeout(() => {
              const itemIndex = this.items.indexOf(item);
              if (itemIndex > -1) {
                this.items.splice(itemIndex, 1);

                // 레벨 종료 중이고 마지막 아이템이면 레벨업
                if (this.isLevelEnding && this.items.length === 0) {
                  this.nextLevel();
                }
              }
            }, 300);
          }
        }
      });

      // 아이템 UI 렌더링
      this.renderItems();
    }, updateInterval);
  }

  /**
   * 아이템이 바구니에 도달했을 때 처리
   */
  handleItemReachedBasket(item) {
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

      // 바구니 흔들림 효과
      this.playBasketCatchAnimation();
    }
  }

  /**
   * 바구니 흔들림 애니메이션 재생
   */
  playBasketCatchAnimation() {
    const basketEl = document.querySelector(`.basket[data-zone="${this.basketPosition}"]`);
    if (!basketEl) return;

    // 클래스 제거 (이전 애니메이션이 있었다면)
    basketEl.classList.remove("catch");

    // 리플로우를 강제로 트리거하여 애니메이션 재시작
    void basketEl.offsetWidth;

    // 클래스 추가
    basketEl.classList.add("catch");

    // 애니메이션 완료 후 클래스 제거
    setTimeout(() => {
      basketEl.classList.remove("catch");
    }, 500);
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

    // 현재 렌더링된 아이템들의 ID 추적
    const existingItemDOMs = new Map();
    gameArea.querySelectorAll(".item").forEach(el => {
      const itemId = el.getAttribute("data-item-id");
      if (itemId) {
        existingItemDOMs.set(itemId, el);
      }
    });

    // 현재 아이템 목록의 ID 추적
    const currentItemIds = new Set(this.items.map(item => item.id));

    // caught 상태가 아닌 기존 DOM 삭제
    existingItemDOMs.forEach((el, itemId) => {
      if (!currentItemIds.has(itemId)) {
        el.remove();
      }
    });

    // 아이템 렌더링
    this.items.forEach(item => {
      const itemId = item.id;
      let itemEl = existingItemDOMs.get(itemId);

      // caught 상태가 아닌 경우만 렌더링
      if (!item.caught) {
        // 새로운 아이템이거나 아직 DOM에 없으면 생성
        if (!itemEl) {
          itemEl = document.createElement("div");
          itemEl.className = `item item-${item.type}`;
          itemEl.textContent = item.icon;
          itemEl.setAttribute("data-zone", item.zone);
          itemEl.setAttribute("data-item-id", itemId);
          gameArea.appendChild(itemEl);
        }

        // 위치 계산 (progress: 0 ~ 1)
        // 아이템이 -20%에서 시작하여 120%까지 떨어짐
        const topPercent = item.progress * 140 - 20;
        itemEl.style.top = `${topPercent}%`;
        // fall 애니메이션을 비활성화하고 수동으로 위치 제어
        itemEl.style.animation = "none";
      } else if (itemEl && !itemEl.classList.contains("caught")) {
        // caught 상태로 변경될 때만 한 번 처리
        itemEl.classList.add("caught");
      }
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

    if (this.levelUpCountdownTimer) {
      clearInterval(this.levelUpCountdownTimer);
      this.levelUpCountdownTimer = null;
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
