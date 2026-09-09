// services/userService.js

const MOCK_USERS = [
    {
        uid: "2059237",
        displayName: "Drew Clarke",
        username: "drew.clarke",
        email: "drew.clarke@emishealth.com",
        telephone: "07700 900123"
    },
    {
        uid: "2059238",
        displayName: "James Croll",
        username: "james.croll",
        email: "james.croll@emishealth.com",
        telephone: "07700 900456"
    }
];

export async function findUser(search) {

    if (!search) {
        return [];
    }

    const term = search.toLowerCase();

    return MOCK_USERS.filter(user =>
        user.displayName.toLowerCase().includes(term)
        || user.username.toLowerCase().includes(term)
        || user.email.toLowerCase().includes(term)
    );
}

export async function getUser(uid) {

    return (
        MOCK_USERS.find(
            user => user.uid === uid
        ) ?? null
    );
}

export async function resetMfa(uid) {

    const user = await getUser(uid);

    if (!user) {

        return {
            success: false,
            message: "User not found"
        };

    }

    console.log(
        `Resetting MFA for ${user.displayName}`
    );

    return {
        success: true,
        uid: user.uid,
        username: user.username,
        message: "MFA reset completed"
    };
}