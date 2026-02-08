import TalkMachine from '../talk-to-me-core/js/TalkMachine.js';

export default class DialogMachine extends TalkMachine {
  constructor() {
    super();
    this.initDialogMachine();
  }

  initDialogMachine() {
    this.dialogStarted = false;
    this.lastState = '';
    this.nextState = '';
    this.waitingForUserInput = true;
    this.stateDisplay = document.querySelector('#state-display');
    this.shouldContinue = false;

    // initialiser les éléments de la machine de dialogue
    this.maxLeds = 10;
    this.ui.initLEDUI();

    // Registre des états des boutons - simple array: 0 = released, 1 = pressed
    this.buttonStates = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  /* CONTRÔLE DU DIALOGUE */
  startDialog() {
    this.dialogStarted = true;
    this.waitingForUserInput = true;
    // éteindre toutes les LEDs
    this.ledsAllOff();
    // effacer la console
    this.fancyLogger.clearConsole();
    // ----- initialiser les variables spécifiques au dialogue -----
    this.nextState = 'initialisation';
    this.buttonPressCounter = 0;
    // Préréglages de voix [index de voix, pitch, vitesse]
    this.preset_voice_normal = ['en-GB', 1, 0.8]; // [voice index, pitch, rate]
    // ----- démarrer la machine avec le premier état -----
    this.dialogFlow();
  }

  /* FLUX DU DIALOGUE */
  /**
   * Fonction principale du flux de dialogue
   * @param {string} eventType - Type d'événement ('default', 'pressed', 'released', 'longpress')
   * @param {number} button - Numéro du bouton (0-9)
   * @private
   */
  dialogFlow(eventType = 'default', button = -1) {
    if (!this.performPreliminaryTests()) {
      // premiers tests avant de continuer vers les règles
      return;
    }
    this.stateUpdate();

    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * Flow du DIALOGUE - Guide visuel du flux de conversation
     * ═══════════════════════════════════════════════════════════════════════════
     *
     * initialisation → welcome → choose-color ─┬→ choose-blue → can-speak → count-press → toomuch → enough-pressed
     *                                           │
     *                                           └→ choose-yellow ──┘ (boucle vers choose-color)
     *
     * CONCEPTS CLÉS DE DIALOGUE DÉMONTRÉS:
     * ✓ Progression linéaire: États qui s'enchaînent (initialisation → welcome)
     * ✓ Embranchement: Le choix de l'utilisateur crée différents chemins (choose-color se divise selon le bouton)
     * ✓ Boucles: La conversation peut retourner à des états précédents (choose-yellow boucle)
     * ✓ Mémoire d'état: Le système se souvient des interactions précédentes (buttonPressCounter)
     * ✓ Initiative système: La machine parle sans attendre d'entrée (can-speak)
     *
     * MODIFIEZ LE DIALOGUE CI-DESSOUS - Ajoutez de nouveaux états dans le switch/case
     * ═══════════════════════════════════════════════════════════════════════════
     */

    switch (this.nextState) {
      case 'initialisation':
        // CONCEPT DE DIALOGUE: État de configuration - prépare le système avant l'interaction
        this.ledsAllOff();
        this.nextState = 'welcome';
        this.fancyLogger.logMessage('initialisation done');
        this.goToNextState();
        break;

      case 'welcome':
        // CONCEPT DE DIALOGUE: Salutation - établit le contexte et définit les attentes
        this.ledsAllChangeColor('white', 1);
        this.fancyLogger.logMessage(
          'Welcome, you have got 2 buttons, press one of them',
        );
        this.nextState = 'choose-color';
        break;

      case 'choose-color':
        // CONCEPT DE DIALOGUE: Branchement - le choix de l'utilisateur affecte le chemin de conversation
        // Bouton 0 = Choix bleu, Bouton 1 = Choix jaune
        if (button == 0) {
          this.nextState = 'choose-blue';
          this.goToNextState();
        }
        if (button == 1) {
          this.nextState = 'choose-yellow';
          this.goToNextState();
        }
        break;

      case 'choose-blue':
        // CONCEPT DE DIALOGUE: Retour positif - renforce le choix de l'utilisateur
        this.fancyLogger.logMessage(
          'blue was a good choice, press any button to continue',
        );
        this.ledsAllChangeColor('green', 0);
        this.nextState = 'can-speak';
        break;

      case 'choose-yellow':
        // CONCEPT DE DIALOGUE: Boucle - la conversation retourne à l'état précédent
        // Cela crée un motif de "réessayer" dans le dialogue
        this.fancyLogger.logMessage(
          'yellow was a bad choice, press blue button to continue',
        );
        this.ledsAllChangeColor('red', 0);
        this.nextState = 'choose-color';
        this.goToNextState();
        break;

      case 'can-speak':
        // CONCEPT DE DIALOGUE: Initiative système - la machine parle sans attendre d'entrée
        this.speakNormal('I can speak, i can count. Press a button.');
        this.nextState = 'count-press';
        this.ledsAllChangeColor('blue', 2);
        break;

      case 'count-press':
        // CONCEPT DE DIALOGUE: Mémoire d'état - le système se souvient des interactions précédentes
        // Le compteur persiste à travers plusieurs pressions de bouton
        this.buttonPressCounter++;

        if (this.buttonPressCounter > 3) {
          this.nextState = 'toomuch';
          this.goToNextState();
        } else {
          this.speakNormal('you pressed ' + this.buttonPressCounter + ' time');
        }
        break;

      case 'toomuch':
        // CONCEPT DE DIALOGUE: Transition conditionnelle - le comportement change selon l'état accumulé
        this.speakNormal('You are pressing too much! I Feel very pressed');
        this.nextState = 'enough-pressed';
        break;

      case 'enough-pressed':
        // CONCEPT DE DIALOGUE: État terminal - la conversation se termine ici
        //this.speak('Enough is enough! I dont want to be pressed anymore!');
        this.speechText(
          'Enough is enough! I dont want to be pressed anymore!',
          ['en-GB', 1, 1.3],
        );
        this.ledsAllChangeColor('red', 1);
        break;

      default:
        this.fancyLogger.logWarning(
          `Sorry but State: "${this.nextState}" has no case defined`,
        );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Autres fonctions
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   *  fonction shorthand pour dire un texte avec la voix prédéfinie
   *  @param {string} _text le texte à dire
   */
  speakNormal(_text) {
    // appelé pour dire un texte
    this.speechText(_text, this.preset_voice_normal);
  }

  /**
   *  fonction shorthand pour forcer la transition vers l'état suivant dans le flux de dialogue
   *  @param {number} delay - le délai optionnel en millisecondes
   * @private
   */
  goToNextState(delay = 0) {
    if (delay > 0) {
      setTimeout(() => {
        this.dialogFlow();
      }, delay);
    } else {
      this.dialogFlow();
    }
  }

  /**
   * Effectuer des tests préliminaires avant de continuer avec le flux de dialogue
   * @returns {boolean} true si tous les tests passent, false sinon
   * @private
   */
  performPreliminaryTests() {
    if (this.dialogStarted === false) {
      this.fancyLogger.logWarning('not started yet, press Start Machine');
      return false;
    }
    if (this.waitingForUserInput === false) {
      this._handleUserInputError();
      return false;
    }
    // vérifier qu'aucune parole n'est active
    if (this.speechIsSpeaking === true) {
      this.fancyLogger.logWarning(
        'im speaking, please wait until i am finished',
      );
      return false;
    }
    if (
      this.nextState === '' ||
      this.nextState === null ||
      this.nextState === undefined
    ) {
      this.fancyLogger.logWarning('nextState is empty or undefined');
      return false;
    }

    return true;
  }

  stateUpdate() {
    this.lastState = this.nextState;
    // Mettre à jour l'affichage de l'état
    if (this.stateDisplay) {
      this.stateDisplay.textContent = this.nextState;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Overrides de TalkMachine
   * ═══════════════════════════════════════════════════════════════════════════
   */
  /**
   * override de _handleButtonPressed de TalkMachine
   * @override
   * @protected
   */
  _handleButtonPressed(button, simulated = false) {
    this.buttonStates[button] = 1;
    if (this.waitingForUserInput) {
      // this.dialogFlow('pressed', button);
    }
  }

  /**
   * override de _handleButtonReleased de TalkMachine
   * @override
   * @protected
   */
  _handleButtonReleased(button, simulated = false) {
    this.buttonStates[button] = 0;
    if (this.waitingForUserInput) {
      this.dialogFlow('released', button);
    }
  }

  /**
   * override de _handleButtonLongPressed de TalkMachine
   * @override
   * @protected
   */
  _handleButtonLongPressed(button, simulated = false) {
    if (this.waitingForUserInput) {
      //this.dialogFlow('longpress', button);
    }
  }

  /**
   * override de _handleTextToSpeechEnded de TalkMachine
   * @override
   * @protected
   */
  _handleTextToSpeechEnded() {
    this.fancyLogger.logSpeech('speech ended');
    if (this.shouldContinue) {
      // aller à l'état suivant après la fin de la parole
      this.shouldContinue = false;
      this.goToNextState();
    }
  }

  /**
   * Gérer l'erreur d'input utilisateur
   * @protected
   */
  _handleUserInputError() {
    this.fancyLogger.logWarning('user input is not allowed at this time');
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Fonctions pour le simulateur
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Gérer les boutons test UI du simulateur
   * @param {number} button - index du bouton
   * @override
   * @protected
   */
  _handleTesterButtons(button) {
    switch (button) {
      case 1:
        this.ledsAllChangeColor('yellow');
        break;
      case 2:
        this.ledsAllChangeColor('green', 1);
        break;
      case 3:
        this.ledsAllChangeColor('pink', 2);
        break;
      case 4:
        this.ledChangeRGB(0, 255, 100, 100);
        this.ledChangeRGB(1, 0, 100, 170);
        this.ledChangeRGB(2, 0, 0, 170);
        this.ledChangeRGB(3, 150, 170, 70);
        this.ledChangeRGB(4, 200, 160, 0);
        break;

      default:
        this.fancyLogger.logWarning('no action defined for button ' + button);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const dialogMachine = new DialogMachine();
});
