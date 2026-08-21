// Traditional Chinese (Taiwan). Mirrors the key structure of ./en.js exactly.
//
// Style: short, spoken Taiwanese Mandarin that keeps the playful FaceRest tone.
// The UI was laid out around English, so copy is kept deliberately tight --
// especially gameplay coaching, which has to be read at a glance mid-exercise.
// "FaceRest" is a brand name and is never translated.

export const zhHant = {
  language: {
    label: '語言',
    switchTo: '切換為{language}',
  },

  landing: {
    tagline: '小小運動，大大放鬆。',
    badge: '每天 3 回合',
    start: '開始吧',
    stageAria: 'Face Reset 介紹',
    mascot: {
      openmouth: '張嘴',
      relax: '放鬆',
      blow: '吹氣',
    },
  },

  permission: {
    kicker: '快速確認',
    title: '請開啟相機',
    body: '允許使用相機就能開始遊戲。',
    cta: '知道了',
    error: '鏡面體驗需要相機權限，請允許使用相機後再試一次。',
    cardAria: '相機權限',
    closeAria: '關閉相機權限',
  },

  scan: {
    title: '臉部偵測',
    subtitle: '把臉對準框框中央',
    scanning: '偵測中',
    paused: '偵測暫停',
    next: '下一步',
    cardAria: '鏡面校正',
    backAria: '返回',
  },

  plan: {
    hero: 'Face Reset 挑戰',
    shellAria: '今日 Face Reset 挑戰',
    todaysFocus: '今日重點',
    dayRecord: '第 {day} 天紀錄',
    warmUpTitle: '臉部暖身',
    session: '第 {index} 回合',
    duration: '30 秒 · {area}',
    done: '完成 | {score}',
    start: '開始',
    continue: '繼續',
    preparing: '準備中',
    dayComplete: '第 {day} 天完成',
    comeBack: '下次練習日再回來',
    calendarDay: '第 {day} 天',
    viewHistory: '查看紀錄',
    closeHistory: '收合',
    progressAria: '已完成 {done} / {total}',
    replayAria: '重玩 {scene}，最佳分數 {score}',
    completedAria: '已完成 {scene}，最佳分數 {score}',
    viewHistoryAria: '查看紀錄',
    closeHistoryAria: '關閉紀錄',
    daySelectorAria: '課程第 {day} 天',
    daySelected: '第 {day} 天',
    viewDayAria: '查看第 {day} 天',
    dayUnavailableAria: '第 {day} 天尚未開放',
  },

  practice: {
    step: '步驟 {index}',
    back: '返回',
    ready: '我準備好了',
    faceNotDetected: '偵測不到臉，請回到畫面中。',
    cardAria: '{scene} 玩法',
    instructionsAria: '玩法說明',
    stageAria: '場景預覽',
  },

  play: {
    points: '分數',
    frontCamera: '前鏡頭',
    cameraPreviewAria: '前鏡頭預覽',
    // Deliberately NOT translated. `Real` / `Mock` / `Demo` are technical
    // detector-mode names that stay English, and a half-Chinese frame around
    // them ("臉 Real") reads worse than leaving the whole readout in English.
    detectorStatus: '{face} face · {hand} hand',
    timeRemainingAria: '剩餘 {time}',
    howToPlay: '玩法說明',
    exit: '離開',
    quitAria: '離開遊戲',
    guideGotIt: '知道了！',
    quitTitle: '要離開「{scene}」嗎？',
    quitBody: '這次的進度不會儲存。',
    quitLeave: '離開',
    quitStay: '繼續玩',
    faceNotDetected: '偵測不到臉，請回到畫面中。',
    niceCatch: '上鉤啦！',
    whaleArtAria: '夢境鯨魚',
  },

  coach: {
    fallback: '跟著畫面提示做動作。',
    initial: {
      whaleDream: '張大嘴，帶小魚游進來',
      whaleDream2: '張大嘴，喚醒河豚的夢',
      templeGarden: '輕輕按住兩邊太陽穴',
      flowerCollector: '皺皺鼻子吸爆米花',
      bubbleGumBunny: '鼓起臉頰吹大泡泡',
      lemonSqueeze: '按住鼻樑兩側',
      penguinFishing: '挑起眉毛拉起魚線',
    },
    temple: {
      noFace: '請露出臉',
      noFingers: '伸出兩根食指',
      oneFinger: '兩手一起放太陽穴',
      notPressing: '手指移到太陽穴',
      onePressing: '兩邊一起按',
      unbalanced: '兩邊力道放平均',
      bloom: '太美了，花園盛開！',
      growing: '輕輕按住，快開花了',
      hold: '穩穩按住太陽穴',
    },
    lemon: {
      noFace: '請露出臉',
      noFingers: '伸出兩根食指',
      oneFinger: '兩指放在鼻樑兩側',
      notPressing: '手指移到鼻樑旁',
      onePressing: '兩邊一起擠',
      notConfirmed: '兩邊穩穩按住',
      unbalanced: '左右力道放平均',
      sip: '有人偷喝一口！',
      fresh: '擠得好，氣泡上來了',
    },
    bunny: {
      noFace: '請露出臉',
      trackingLost: '追蹤暫停，請回到畫面中',
      calibrateRelax: '放鬆臉部，校正中',
      calibrateHold: '先別動，兔兔正在記你的臉',
      mouthOpen: '閉上嘴，再鼓臉頰',
      notPuffing: '閉著嘴，兩頰一起鼓',
      notStable: '泡泡穩住',
      combo: '節奏超讚，兔兔愛了',
      nearlyFull: '撐住，泡泡快滿了',
      growing: '鼓得好，泡泡再大一點',
    },
    penguin: {
      noFace: '請露出臉',
      justCaught: '上鉤了！放鬆再來一次',
      notFishing: '挑起眉毛拉起魚線',
      notHolding: '眉毛輕輕撐住',
      strong: '拉得好，繼續往上',
      steady: '穩住，魚在咬餌了',
    },
    popcorn: {
      noFace: '請露出臉',
      notSniffing: '皺皺鼻子吸爆米花',
      notControlled: '輕輕吸住',
      strong: '吸得好，爆米花來了',
      more: '很好，再皺用力一點',
    },
    whale: {
      noFace: '請露出臉',
      notOpen: '張大嘴，讓小魚游進來',
      notStable: '嘴巴穩穩張著',
      wide: '很棒，小魚游進來了',
      wider: '不錯，再張大一點',
    },
  },

  result: {
    shellAria: 'Face Reset 挑戰結果',
    todaysPlan: '今日計畫',
    historyAria: '結果紀錄',
    historyOpen: '查看紀錄',
    historyClose: '關閉紀錄',
    cardsAria: '結果卡片',
    toolsAria: '結果工具',
    downloadAria: '下載',
    shareAria: '分享',
    scoreboard: '第 {day} 天 · 排行榜',
    outOf: '/ 300',
    personalBest: '個人新紀錄',
    leaderboardAria: '第 {day} 天排行榜',
    leaderboardEmpty: '完成 3 回合，搶下第 {day} 天第一名。',
    leaderboardLoading: '排行榜載入中…',
    name: {
      title: '你進前 10 名了！',
      body: '輸入暱稱就能登上排行榜。',
      placeholder: '輸入你的暱稱',
      fieldAria: '暱稱',
      closeAria: '關閉暱稱輸入',
      submit: '加入排行榜',
      saving: '儲存中…',
      errorEmpty: '請先輸入暱稱才能加入排行榜。',
      errorSync: '已存在這台裝置。請檢查網路後再試一次，才能同步到排行榜。',
    },
  },

  share: {
    creating: '正在製作分享卡…',
    downloaded: '分享卡已下載。',
    createFailed: '分享卡製作失敗，請再試一次。',
    preparing: '正在準備分享卡…',
    sheetOpened: '已開啟分享選單。',
    sheetUnavailable: '這個瀏覽器無法直接開啟分享選單，已改為下載分享卡。',
    cancelled: '已取消分享。',
    failed: '這裡無法分享，請改用下載。',
  },

  // Display names only. Scene IDs, canonical English titles, areaKey values and
  // everything written to history or Supabase stay untouched.
  scenes: {
    whaleDream: {
      title: '鯨魚開飯了',
      faceArea: '嘴部',
      description: '輕輕張開嘴巴並穩穩撐住，小魚就會游進鯨魚嘴裡。',
      tips: [
        '把臉維持在畫面中央。',
        '輕輕張嘴，穩穩撐住。',
        '跟著呼吸，看海洋一起變化。',
      ],
    },
    whaleDream2: {
      title: '鯨魚夢遊 2',
      faceArea: '嘴部',
      description: '輕輕張開嘴巴並穩穩撐住，喚醒河豚的夢。',
      tips: [
        '把臉維持在畫面中央。',
        '輕輕張嘴，穩穩撐住。',
        '跟著呼吸，看海洋一起變化。',
      ],
    },
    templeGarden: {
      title: '雲朵放鬆術',
      faceArea: '太陽穴',
      description: '兩根食指放在太陽穴上，慢慢按下再放開。',
      tips: [
        '兩手同時進行。',
        '兩邊指尖都要入鏡。',
        '力道輕柔平均，花園就會長大。',
      ],
    },
    flowerCollector: {
      title: '吸吸爆米花',
      faceArea: '鼻部',
      description: '輕輕皺起鼻子，再放鬆，重複幾次。',
      tips: [
        '把臉維持在畫面中央。',
        '輕輕皺起鼻子。',
        '每次吸得好，就多收一些爆米花。',
      ],
    },
    bubbleGumBunny: {
      title: '兔子吹氣球',
      faceArea: '臉頰',
      description: '先放鬆一下讓兔兔記住你的臉，接著鼓起臉頰撐到泡泡爆開。',
      tips: [
        '嘴唇輕輕閉起來。',
        '兩頰一起鼓，穩穩撐住。',
        '泡泡吹滿就會自己爆開。',
      ],
    },
    lemonSqueeze: {
      title: '壓榨檸檬汁',
      faceArea: '面中',
      description: '兩根食指放在鼻樑兩側，輕輕往內按再放開。',
      tips: [
        '兩邊指尖都要入鏡。',
        '兩邊一起按。',
        '慢慢擠再放開，汽水會更多。',
      ],
    },
    penguinFishing: {
      title: '企鵝等上鉤',
      faceArea: '眉部',
      description: '輕輕挑起兩邊眉毛並穩穩撐住，把魚線從冰洞裡拉上來。',
      tips: [
        '把臉維持在畫面中央並放鬆。',
        '輕輕挑眉，下巴不要抬起來。',
        '撐到企鵝釣到魚，再放鬆重複。',
      ],
    },
  },
};
