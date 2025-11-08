function MeetsMCATRequirement(d) {
    let rawScore = parseInt(d["MCAT Minimum"], 10);
    rawScore = d["MCAT Minimum"].includes("/") ? NaN : rawScore;

    let mcat0 = parseInt(document.getElementById("Chem/Phys").value);
    let mcat1 = parseInt(document.getElementById("Bio/Biochem").value);
    let mcat2 = parseInt(document.getElementById("Psych/Soc").value);
    let mcat3 = parseInt(document.getElementById("CARS").value);
    // console.log(mcat0 + mcat1 + mcat2 + mcat3);
    let totalScore = mcat0 + mcat1 + mcat2 + mcat3;
    let sectionScores = d["MCAT Minimum"].split("/");
    sectionScores = sectionScores.map(score => parseInt(score));

    // guard for 'NA' MCAT requirements
    if (isNaN(rawScore) && !d["MCAT Minimum"].includes("/")) {
        // console.log(d["Name"] + " first " + sectionScores + " " + [mcat0, mcat1, mcat2, mcat3]);
        return true;
    }
    // MCAT total score is in dataset
    else if (!isNaN(totalScore) && !isNaN(rawScore) && totalScore >= rawScore) {
        // console.log(rawScore);
        // console.log(d["Name"] + " second " + sectionScores + " " + [mcat0, mcat1, mcat2, mcat3]);
        return true;
    } else if (!d["MCAT Minimum"].includes("/")) {
        return false; // insufficient input to determine if student is eligible
    }

    let meetsReqForSection = (student, req) => isNaN(req) || (student >= req && !isNaN(student));

    return meetsReqForSection(mcat0, sectionScores[0]) &&
        meetsReqForSection(mcat1, sectionScores[1]) &&
        meetsReqForSection(mcat2, sectionScores[2]) &&
        meetsReqForSection(mcat3, sectionScores[3]);
}

function MeetsGPARequirement(d) {
    let req = parseFloat(d["GPA Minimum"]);
    let gpa = parseFloat(document.getElementById("gpa-slider").value);
    // console.log(gpa + " " + req + " " + d["Name"]);
    return isNaN(req) || (gpa >= req) || (req >= 85 && gpa >= 3.7); // ubc records in percentage
}

function MeetsResidenceRequirement(d) {
    let canadianCitizenInput = document.getElementById("canadian-citizen");
    return !d["Residence Requirements"].includes("Citizen") || canadianCitizenInput.checked;
}

function MeetsCasperRequirement(d) {
    let casperInput = document.getElementById("taken-casper");
    return !d["Requires CASPER"].includes("Yes") || casperInput.checked;
}

function CanApply(d) {
    let hasResidenceRequirement = MeetsResidenceRequirement(d);
    let meetsMCAT = MeetsMCATRequirement(d);
    let meetsGPA = MeetsGPARequirement(d);
    let meetsCASPER = MeetsCasperRequirement(d);

    return hasResidenceRequirement && meetsMCAT && meetsGPA && meetsCASPER;
}

function ApplicantCategory(d) {
    let hasResidenceRequirement = MeetsResidenceRequirement(d);
    let meetsMCAT = MeetsMCATRequirement(d);
    let meetsGPA = MeetsGPARequirement(d);
    let meetsCASPER = MeetsCasperRequirement(d);

    if (CanApply(d) === true) {
        return 0;
    } else if (!hasResidenceRequirement && meetsMCAT && meetsGPA && meetsCASPER) {
        return 4;
    } else if (!meetsMCAT && meetsGPA && meetsCASPER && hasResidenceRequirement) {
        return 3;
    } else if (!meetsGPA && meetsCASPER && meetsMCAT && hasResidenceRequirement) {
        return 2;
    } else if (!meetsCASPER && meetsMCAT && meetsGPA && hasResidenceRequirement) {
        return 1;
    } else { // inadmissible in multiple ways
        return 5;
    }
}
