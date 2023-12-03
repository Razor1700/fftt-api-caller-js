import * as CryptoJS from 'crypto-js';
import {Observable, of} from "rxjs";
import {OrganismType} from "./organism-type";
import {ClubParameterType} from "./club-parameter-type";
import {TrialType} from "./trial-type";
import {ResultByDivisionType} from "./result-by-division-type";
import {ResultInfo} from "./result-info";
import {SearchTeamByClubType} from "./search-team-by-club-type";
import {IndividualResultType} from "./individual-result-type";


export class FFTTApiCaller{
    private static FFTT_BACKEND_URL = "https://www.fftt.com/mobile/pxml";
    private static USER_SERIAL_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    private static USER_SERIAL_STORAGE_KEY = "userSerialFFTT"

    private userSerialNumber;
    private readonly appId;
    private readonly password;

    /**
     * Initialized the service with parameters given by fftt
     * @param password delivered by fftt
     * @param appId delivered by fftt
     */
    constructor(password, appId) {
        this.password = password;
        this.appId = appId;
    }

    private initHeader(url){
        const timestampString = this.getTimeStampString(new Date());
        const cryptedTimestamp = this.encryptTimestamp(timestampString);
        return url + `?serie=${this.userSerialNumber}&tm=${timestampString}&tmc=${cryptedTimestamp}&id=${this.appId}`;
    }

    private encryptTimestamp(timestampString){
        return CryptoJS.HmacSHA1(timestampString, CryptoJS.MD5(this.password).toString());
    }

    private getTimeStampString(timeStamp: Date){
        const year = ("0000"+timeStamp.getFullYear()).slice(-4);
        const month = ("00"+(timeStamp.getMonth() +1)).slice(-2);
        const day = ("00"+timeStamp.getDate()).slice(-2);
        const hour = ("00"+timeStamp.getHours()).slice(-2);
        const minute = ("00"+timeStamp.getMinutes()).slice(-2);
        const second = ("00"+timeStamp.getSeconds()).slice(-2);
        const milli = ("000"+timeStamp.getMilliseconds()).slice(-3);
        return year.concat(month).concat(day).concat(hour).concat(minute).concat(second).concat(milli);
    }

    private doXmlRequest(urlSubPath: string, ...params: {key: string, value: string}[]): Observable<string>{
        return new Observable<string>(observer => {
            const xmlHttpRequest = new XMLHttpRequest();
            let url = this.initHeader(`${FFTTApiCaller.FFTT_BACKEND_URL}${urlSubPath}`);
            params?.filter(param => !!param)?.forEach(param => {
                url += `&${param.key}=${param.value}`;
            });
            xmlHttpRequest.open("GET", url);
            xmlHttpRequest.send();

            xmlHttpRequest.onloadend = (e) => {
                observer.next(xmlHttpRequest.responseText);
                observer.complete();
            }

            xmlHttpRequest.onerror = (e) => {
                observer.error(e);
                observer.complete();
            }
        });
    }

    /**
     * initialize a session for the current user to call the api
     * @return xml result
     */
    initializeUser(): Observable<string>{
        this.userSerialNumber = sessionStorage.getItem(FFTTApiCaller.USER_SERIAL_STORAGE_KEY) || "";
        if(this.userSerialNumber.length === 0) {
            while (this.userSerialNumber.length < 15)
                this.userSerialNumber += FFTTApiCaller.USER_SERIAL_CHARACTERS.charAt(Math.floor(Math.random() * FFTTApiCaller.USER_SERIAL_CHARACTERS.length));
            return this.doXmlRequest("/xml_initialisation.php");
        }
        sessionStorage.setItem(FFTTApiCaller.USER_SERIAL_STORAGE_KEY, this.userSerialNumber);
        return of("Already authenticated");
    }

    /**
     * Get all club of a department
     * @param department department id
     * @return xml result
     */
    getClubsByDepartment(department: string): Observable<string>{
        return this.doXmlRequest("/xml_club_dep2.php", {key: "dep", value: department});
    }

    /**
     * Get all organisms
     * @param type
     * @param parentId (optional) if specified, returns only organisms child of that parent
     * @return xml result
     */
    getOrganisms(type: OrganismType, parentId?:string): Observable<string>{
        return this.doXmlRequest("/xml_organisme.php",{key: "type", value: type.valueOf()}, parentId ? {key: "pere", value: parentId} : undefined!);
    }

    /**
     * Get all club by parameters
     * @param value
     * @param type parameter type apply to the search
     * @return xml result
     */
    getClubsBy(value: string, type: ClubParameterType): Observable<string>{
        return this.doXmlRequest("/xml_club_b.php", {key: type.valueOf(), value});
    }

    /**
     * Get club detail
     * @param clubNo
     * @param teamId (optional) if specified returns the team favorite location. Otherwise returns the club default location
     * @return xml result
     */
    getClubDetail(clubNo: string, teamId?:string): Observable<string>{
        return this.doXmlRequest("/xml_club_detail.php", {key: "club", value: clubNo}, teamId ? {key: "idequipe", value: teamId} : undefined!);
    }

    /**
     * Get trials by organism
     * @param organismId
     * @param type
     * @return xml result
     */
    getTrialsByOrganism(organismId: string, type: TrialType): Observable<string>{
        return this.doXmlRequest("/xml_epreuve.php", {key: "organisme", value: organismId}, {key: "type", value: type.valueOf()});
    }

    /**
     * Get division by trial
     * @param organismId
     * @param trialId
     * @param type
     * @return xml result
     */
    getDivisionByTrial(organismId: string, trialId: string, type: TrialType): Observable<string>{
        return this.doXmlRequest("/xml_division.php", {key: "organisme", value: organismId}, {key: "epreuve", value: trialId}, {key: "type", value: type.valueOf()});
    }

    /**
     * Get results by division
     * @param divisionId
     * @param type
     * @param idPool (optional) if present returns the result of the specified pool. Otherwise returns the results of the first pool
     * @return xml result
     */
    getResultsByDivision(divisionId: string, type: ResultByDivisionType, idPool?: string): Observable<string>{
        return this.doXmlRequest("/xml_result_equ.php", {key: "D1", value: divisionId}, {key: "action", value: type.valueOf()}, {key: "auto", value: "1"},
            idPool ? {key: "cx_pool", value: idPool} : undefined!);
    }

    /**
     * Get results by pool
     * @param idPools
     */
    getResultByPool(idPools: string[]): Observable<string>{
        return this.doXmlRequest("/xml_rencontre_equ.php", {key: "poule", value: idPools.length > 1 ? idPools.join("|") : idPools[0]});
    }

    /**
     * Get result detail
     * @param resultInfo "lien" params from the result of getResultByPool request
     */
    getResultDetail(resultInfo: ResultInfo): Observable<string>{
        return this.doXmlRequest("/xml_chp_renc.php", {key: "is_retour", value: resultInfo.is_retour + ""},
            {key: "phase", value: resultInfo.phase},  {key: "res_1", value: resultInfo.res_1},  {key: "res_2", value: resultInfo.res_2},
            {key: "renc_id", value: resultInfo.renc_id},  {key: "equip_1", value: resultInfo.equip_1},  {key: "equip_2", value: resultInfo.equip_2},
            {key: "equip_id1", value: resultInfo.equip_id1},  {key: "equip_id2", value: resultInfo.equip_id2});
    }

    /**
     * Get team by club
     * @param clubNo
     * @param type
     */
    getTeamByClub(clubNo:string, type: SearchTeamByClubType): Observable<string>{
        return this.doXmlRequest("/xml_equipe.php", {key: "numclu", value: clubNo},
            {key: "type", value: type.valueOf()});
    }

    /**
     * Get individual result
     * @param type
     * @param trialId
     * @param divisionId
     * @param groupId (optional)
     */
    getIndividualResult(type: IndividualResultType, trialId: string, divisionId: string, groupId?: string): Observable<string>{
        return this.doXmlRequest("/xml_result_indiv.php", {key: "action", value: type.valueOf()},
            {key: "epr", value: trialId},  {key: "res_division", value: divisionId},  groupId ? {key: "cx_tableau", value: groupId} : undefined!);
    }

    /**
     * Get global ranking from criterium division
     * @param divisionId
     */
    getCriteriumRanking(divisionId: string): Observable<string>{
        return this.doXmlRequest("/xml_res_cla.php", {key: "res_division", value: divisionId});
    }

    /**
     * Find players filtered by parameters
     * @param clubNo (optional)
     * @param lastname (optional)
     * @param firstname (optional)
     * You should provide at least the club or lastname
     */
    findPlayersBy(clubNo?: string, lastname?: string, firstname?: string): Observable<string>{
        return this.doXmlRequest("/xml_liste_joueur.php", clubNo ? {key: "club", value: clubNo} : undefined!,
            lastname ? {key: "nom", value: lastname} : undefined!, firstname ? {key: "prenom", value: firstname} : undefined!);
    }

    /**
     * Find players from spid filtered by parameters
     * @param clubNo (optional)
     * @param licence (optional)
     * @param lastname (optional)
     * @param firstname (optional)
     * @param valid (optional)
     * * You should provide at least the club or lastname or licence
     */
    findSpidPlayersBy(clubNo?: string, licence?: string, lastname?: string, firstname?: string, valid?: boolean): Observable<string>{
        return this.doXmlRequest("/xml_liste_joueur_o.php", clubNo ? {key: "club", value: clubNo} : undefined!,
            lastname ? {key: "nom", value: lastname} : undefined!, firstname ? {key: "prenom", value: firstname} : undefined!,
            licence ? {key: "licence", value: licence} : undefined!, valid !== undefined ? {key: "valid", value: valid+""} : undefined!);
    }

    /**
     * Find player by licence
     * @param licence
     */
    findPlayerByLicence(licence: string): Observable<string>{
        return this.doXmlRequest("/xml_joueur.php", {key: "licence", value: licence});
    }

    /**
     * Find player from spid by licence
     * @param licence
     */
    findSpidPlayerByLicence(licence: string): Observable<string>{
        return this.doXmlRequest("/xml_licence.php", {key: "licence", value: licence});
    }

    /**
     * Find detailed info from spid of one player by licence or multiples players by club
     * @param licenceOrClub
     */
    findDetailedSpidPlayersByLicence(licenceOrClub: string): Observable<string>{
        return this.doXmlRequest("/xml_licence_b.php", {key: "licence", value: licenceOrClub});
    }

    /**
     * GIRPE only !
     * Find detailed info from spid of one player by licence or multiples players by club
     * @param licenceOrClub
     */
    findDetailedSpidPlayersByLicenceForGirpe(licenceOrClub: string): Observable<string>{
        return this.doXmlRequest("/xml_licence_c.php", {key: "licence", value: licenceOrClub});
    }

    /**
     * Get all player games by licence
     * @param licence
     */
    getPlayerGamesByLicence(licence: string): Observable<string>{
        return this.doXmlRequest("/xml_partie_mysql.php", {key: "licence", value: licence});
    }

    /**
     * Get all player games from spid by licence
     * @param licence
     */
    getSpidPlayerGamesByLicence(licence: string): Observable<string>{
        return this.doXmlRequest("/xml_partie.php", {key: "numlic", value: licence});
    }

    /**
     * Get FFTT news
     */
    getNews(): Observable<string>{
        return this.doXmlRequest("/xml_new_actu.php");
    }

    /**
     * Get player rank history by licence
     * @param licence
     */
    getPlayerRankHistoryByLicence(licence: string): Observable<string>{
        return this.doXmlRequest("/xml_histo_classement.php", {key: "numlic", value: licence});
    }
}