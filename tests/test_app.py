from copy import deepcopy

import pytest
from fastapi.testclient import TestClient


def test_root_redirects_to_web_interface(client: TestClient):
    # Arrange
    url = "/"

    # Act
    response = client.get(url, follow_redirects=False)

    # Assert
    assert response.status_code == 307
    assert response.headers["location"] == "/static/index.html"


def test_list_activities(client: TestClient, activity_data):
    # Arrange
    expected = deepcopy(activity_data)

    # Act
    response = client.get("/activities")

    # Assert
    assert response.status_code == 200
    assert response.json() == expected


def test_signup_is_immediately_visible(client: TestClient, activity_data):
    # Arrange
    name = "Test Sports & Arts"
    email = "new+student@mergington.edu"
    expected = deepcopy(activity_data)
    expected[name]["participants"].append(email)

    # Act
    response = client.post(
        f"/activities/{name}/signup", params={"email": email}
    )
    updated = client.get("/activities")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": f"Signed up {email} for {name}"}
    assert updated.status_code == 200
    assert updated.json() == expected


def test_duplicate_signup_leaves_activities_unchanged(
    client: TestClient, activity_data
):
    # Arrange
    name = "Test Sports & Arts"
    email = activity_data[name]["participants"][0]
    original = deepcopy(activity_data)

    # Act
    response = client.post(
        f"/activities/{name}/signup", params={"email": email}
    )

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "Student already signed up"}
    assert activity_data == original


@pytest.mark.parametrize(
    ("method", "action"), [("POST", "signup"), ("DELETE", "unregister")]
)
def test_unknown_activity_returns_404(
    client: TestClient, activity_data, method: str, action: str
):
    # Arrange
    original = deepcopy(activity_data)
    url = f"/activities/Unknown%20Activity/{action}"

    # Act
    response = client.request(
        method, url, params={"email": "student@mergington.edu"}
    )

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}
    assert activity_data == original


def test_unregister_removes_only_selected_participant(
    client: TestClient, activity_data
):
    # Arrange
    name = "Test Sports & Arts"
    email = activity_data[name]["participants"][0]
    expected = deepcopy(activity_data)
    expected[name]["participants"].remove(email)

    # Act
    response = client.delete(
        f"/activities/{name}/unregister", params={"email": email}
    )
    updated = client.get("/activities")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": f"Unregistered {email} from {name}"}
    assert updated.status_code == 200
    assert updated.json() == expected


def test_unregister_missing_participant_leaves_activities_unchanged(
    client: TestClient, activity_data
):
    # Arrange
    original = deepcopy(activity_data)
    url = "/activities/Test%20Sports%20%26%20Arts/unregister"

    # Act
    response = client.delete(url, params={"email": "missing@mergington.edu"})

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Student is not signed up"}
    assert activity_data == original


@pytest.mark.parametrize(
    ("method", "action"), [("POST", "signup"), ("DELETE", "unregister")]
)
def test_missing_email_returns_422(
    client: TestClient, activity_data, method: str, action: str
):
    # Arrange
    original = deepcopy(activity_data)
    url = f"/activities/Test%20Sports%20%26%20Arts/{action}"

    # Act
    response = client.request(method, url)

    # Assert
    assert response.status_code == 422
    assert any(
        error["loc"] == ["query", "email"]
        for error in response.json()["detail"]
    )
    assert activity_data == original
