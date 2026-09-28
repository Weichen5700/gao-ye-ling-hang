(function (global) {
  'use strict';

  function getProjectRoot() {
    try {
      if (document.currentScript && document.currentScript.src) {
        return new URL('../', document.currentScript.src).href;
      }
    } catch (e) {}
    try {
      if (typeof location !== 'undefined' && location.href) {
        return new URL('./', location.href).href;
      }
    } catch (e) {}
    return '';
  }

  const projectRoot = getProjectRoot();

  const offlineBanks = Object.freeze({
    '理財規劃人員': {
      globalName: 'FINANCIAL_PLANNING_OFFLINE_QUESTIONS',
      url: projectRoot ? new URL('data/理財規劃人員/offline-question-bank.js', projectRoot).href : 'data/理財規劃人員/offline-question-bank.js'
    },
    '證券商高級業務員': {
      globalName: 'SECURITIES_SENIOR_OFFLINE_QUESTIONS',
      url: projectRoot ? new URL('data/證券商高級業務員/offline-question-bank.js', projectRoot).href : 'data/證券商高級業務員/offline-question-bank.js'
    }
  });

  const highGradeSessions = [];
  for (let year = 115; year >= 105; year--) {
    const lastSession = year <= 109 ? 4 : year <= 114 ? 3 : 2;
    for (let session = lastSession; session >= 1; session--) {
      highGradeSessions.push({
        file: `${year}${String(session).padStart(2, '0')}_全科.txt`,
        label: `${year}年第${session}次（150題）`
      });
    }
  }
  const highGradeManifestFiles = [
    { file: '00_全部考古題.txt', label: '全部考古題（5,550題）' },
    { file: '01_投資學_全部.txt', label: '投資學（1,850題）' },
    { file: '02_財務分析_全部.txt', label: '財務分析（1,850題）' },
    { file: '03_證券交易相關法規與實務_全部.txt', label: '證券交易相關法規與實務（1,850題）' },
    { file: '04_近三次全科.txt', label: '近三次全科（450題）' },
    ...highGradeSessions
  ];

  const manifest = Object.freeze([
    {
      "category": "理財規劃人員",
      "files": [
        {
          "file": "00_全部考古題.txt",
          "label": "全部考古題（2,100題）"
        },
        {
          "file": "01_理財工具_全部.txt",
          "label": "理財工具（1,050題）"
        },
        {
          "file": "02_理財規劃實務_全部.txt",
          "label": "理財規劃實務（1,050題）"
        },
        {
          "file": "48_第48屆.txt",
          "label": "第48屆（100題）"
        },
        {
          "file": "47_第47屆.txt",
          "label": "第47屆（100題）"
        },
        {
          "file": "46_第46屆.txt",
          "label": "第46屆（100題）"
        },
        {
          "file": "45_第45屆.txt",
          "label": "第45屆（100題）"
        },
        {
          "file": "44_第44屆.txt",
          "label": "第44屆（100題）"
        },
        {
          "file": "43_第43屆.txt",
          "label": "第43屆（100題）"
        },
        {
          "file": "42_第42屆.txt",
          "label": "第42屆（100題）"
        },
        {
          "file": "41_第41屆.txt",
          "label": "第41屆（100題）"
        },
        {
          "file": "40_第40屆.txt",
          "label": "第40屆（100題）"
        },
        {
          "file": "39_第39屆.txt",
          "label": "第39屆（100題）"
        },
        {
          "file": "38_第38屆.txt",
          "label": "第38屆（100題）"
        },
        {
          "file": "37_第37屆.txt",
          "label": "第37屆（100題）"
        },
        {
          "file": "36_第36屆.txt",
          "label": "第36屆（100題）"
        },
        {
          "file": "35_第35屆.txt",
          "label": "第35屆（100題）"
        },
        {
          "file": "34_第34屆.txt",
          "label": "第34屆（100題）"
        },
        {
          "file": "33_第33屆.txt",
          "label": "第33屆（100題）"
        },
        {
          "file": "31_第31屆.txt",
          "label": "第31屆（100題）"
        },
        {
          "file": "30_第30屆.txt",
          "label": "第30屆（100題）"
        },
        {
          "file": "29_第29屆.txt",
          "label": "第29屆（100題）"
        },
        {
          "file": "28_第28屆.txt",
          "label": "第28屆（100題）"
        },
        {
          "file": "27_第27屆.txt",
          "label": "第27屆（100題）"
        }
      ]
    },
    {
      category: '證券商高級業務員',
      files: highGradeManifestFiles
    }
  ]);

  const bankDataPromises = new Map();

  function cloneQuestions(questions) {
    if (typeof structuredClone === 'function') return structuredClone(questions);
    return JSON.parse(JSON.stringify(questions));
  }

  function ensureBankData(category) {
    const config = offlineBanks[category];
    if (!config) return Promise.reject(new Error('不支援的離線題庫：' + category));
    if (Array.isArray(global[config.globalName])) {
      return Promise.resolve(global[config.globalName]);
    }
    if (bankDataPromises.has(category)) return bankDataPromises.get(category);

    const dataPromise = new Promise((resolve, reject) => {
      if (typeof document === 'undefined' || !document.head) {
        if (Array.isArray(global[config.globalName])) {
          resolve(global[config.globalName]);
        } else {
          reject(new Error('非瀏覽器環境，請手動載入離線題庫全域變數'));
        }
        return;
      }
      const script = document.createElement('script');
      script.src = config.url;
      script.onload = () => {
        if (Array.isArray(global[config.globalName])) {
          resolve(global[config.globalName]);
        } else {
          reject(new Error('離線題庫格式不正確'));
        }
      };
      script.onerror = (err) => {
        console.error('載入離線腳本失敗:', config.url, err);
        if (Array.isArray(global[config.globalName])) {
          resolve(global[config.globalName]);
        } else {
          reject(new Error('無法讀取本機離線題庫'));
        }
      };
      document.head.appendChild(script);
    });

    bankDataPromises.set(category, dataPromise);
    return dataPromise;
  }

  async function load(filePath) {
    const match = /^data\/([^/]+)\//.exec(filePath);
    if (!match || !offlineBanks[match[1]]) {
      return null;
    }

    const category = match[1];
    const allQuestions = await ensureBankData(category);
    const fileName = filePath.split('/').pop() || '';

    if (category === '證券商高級業務員') {
      if (fileName === '00_全部考古題.txt') return cloneQuestions(allQuestions);
      const subjectFiles = {
        '01_投資學_全部.txt': '投資學',
        '02_財務分析_全部.txt': '財務分析',
        '03_證券交易相關法規與實務_全部.txt': '證券交易相關法規與實務'
      };
      if (subjectFiles[fileName]) {
        const subject = subjectFiles[fileName];
        return cloneQuestions(allQuestions.filter(q => q.source?.subject === subject));
      }
      if (fileName === '04_近三次全科.txt') {
        const sessions = [...new Set(allQuestions.map(q => `${q.source?.examYear}-${q.source?.examSession}`))]
          .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
          .slice(0, 3);
        const selected = new Set(sessions);
        return cloneQuestions(allQuestions.filter(q => selected.has(`${q.source?.examYear}-${q.source?.examSession}`)));
      }
      const sessionMatch = fileName.match(/^(10\d|11\d)(0[1-4])_全科\.txt$/);
      if (sessionMatch) {
        const examYear = Number(sessionMatch[1]) + 1911;
        const examSession = Number(sessionMatch[2].slice(1));
        return cloneQuestions(allQuestions.filter(q =>
          q.source?.examYear === examYear && q.source?.examSession === examSession
        ));
      }
      throw new Error('離線題庫找不到高業篩選項目：' + fileName);
    }

    if (fileName === '00_全部考科.txt' || fileName === '00_全部考古題.txt') {
      return cloneQuestions(allQuestions);
    }
    if (fileName === '01_理財工具_全部.txt') {
      return cloneQuestions(allQuestions.filter(q => String(q.class || '').endsWith('理財工具')));
    }
    if (fileName === '02_理財規劃實務_全部.txt') {
      return cloneQuestions(allQuestions.filter(q => String(q.class || '').endsWith('理財規劃實務')));
    }
    const sessionMatch = fileName.match(/^(\d{2})_第(\d{2})屆\.txt$/);
    if (sessionMatch) {
      const s = sessionMatch[2];
      return cloneQuestions(allQuestions.filter(q => String(q.class || '').startsWith('第' + s + '屆')));
    }

    const subject = fileName.replace(/^\d+_/, '').replace(/\.txt$/i, '');
    const selectedQuestions = allQuestions.filter(
      question => question.class === (category + '－' + subject) || question.class.includes(subject)
    );
    if (!selectedQuestions.length) throw new Error('離線題庫找不到考科：' + subject);
    return cloneQuestions(selectedQuestions);
  }

  global.OfflineQuestionBanks = Object.freeze({ load, manifest });
})(typeof window !== 'undefined' ? window : globalThis);
